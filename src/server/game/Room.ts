import * as utilities from "../core/utilities";
import * as universal from "../universal";
import * as enemy from "./Enemy";
import * as _ from "lodash";
import { log } from "../core/log";
import * as input from "../core/input";

const STANDARD_ENEMY_CHANCE: number = 0.25;

enum InputAction {
  Unknown = 0,
  AddDigit = 1,
  RemoveDigit = 2,
  SendAnswer = 3,
  AddSubtractionSign = 4
}

enum GameMode {
  EasySingleplayer = "easySingleplayer",
  StandardSingleplayer = "standardSingleplayer",
  InsaneSingleplayer = "insaneSingleplayer",
  DefaultMultiplayer = "defaultMultiplayer",
  CustomMultiplayer = "customMultiplayer"
}
interface InputActionInterface {
  action: InputAction;
  argument: string;
}
interface ClockInterface {
  [key: string]: {
    currentTime: number;
    actionTime: number;
  };
}

class GameData {
  score!: number;
  enemiesKilled!: number;
  enemiesSpawned!: number;
  enemies!: Array<enemy.Enemy>;
  baseHealth!: number;
  combo!: number;
  owner: string;
  clocks!: ClockInterface;
  enemiesToErase!: Array<string>;
  currentInput!: string;
  elapsedTime!: number;
  enemySpeedCoefficient!: number;
  commands!: { [key: string]: any };
  mode: string;
  enemySpawnThreshold!: number;
  // ...
  constructor(owner: string, mode: GameMode) {
    this.mode = mode;
    this.score = 0;
    this.enemiesKilled = 0;
    this.enemiesSpawned = 0;
    this.baseHealth = 100;
    this.owner = owner;
    this.enemies = [];
    this.enemiesToErase = [];
    this.currentInput = "";
    this.elapsedTime = 0;
    this.combo = -1;
    this.commands = {};
    if (mode === GameMode.EasySingleplayer) {
      this.clocks = {
        enemySpawn: {
          currentTime: 0,
          actionTime: 250
        },
        comboResetTime: {
          currentTime: 0,
          actionTime: 10000
        }
      };
      this.enemySpeedCoefficient = 0.25;
      this.enemySpawnThreshold = 0.05;
    } else {
      this.clocks = {
        enemySpawn: {
          currentTime: 0,
          actionTime: 100
        },
        comboResetTime: {
          currentTime: 0,
          actionTime: 5000
        }
      };
      this.enemySpeedCoefficient = 1;
      this.enemySpawnThreshold = 0.2;
    }
  }
}
class SingleplayerGameData extends GameData {
  // nothing here yet...

  constructor(owner: string, gameMode: GameMode) {
    if (
      !(
        gameMode === GameMode.EasySingleplayer ||
        gameMode === GameMode.StandardSingleplayer
      )
    ) {
      log.error(
        "Non-singleplayer game mode passed as argument in a singleplayer room."
      );
      return;
    }
    super(owner, gameMode);
  }
}

class Room {
  id: string;
  hostConnectionID: string;
  memberConnectionIDs: Array<string> = [];
  spectatorConnectionIDs: Array<string> = [];
  updateNumber: number = 0;
  playing: boolean = false;
  gameData: Array<GameData> = [];
  lastUpdateTime: number;
  mode!: GameMode;
  constructor(hostConnectionID: string, gameMode: GameMode) {
    this.mode = gameMode;
    this.id = generateRoomID(8);
    this.hostConnectionID = hostConnectionID;
    this.addMember(hostConnectionID);
    this.lastUpdateTime = Date.now();
  }

  update() {
    let now: number = Date.now();
    let deltaTime: number = now - this.lastUpdateTime;

    this.lastUpdateTime = now;

    if (!this.playing) {
      return;
    }

    // Update for all types of rooms
    for (let i = 0; i < this.gameData.length; i++) {
      for (let clock in this.gameData[i].clocks) {
        this.gameData[i].elapsedTime += deltaTime;
        this.gameData[i].clocks[clock].currentTime += deltaTime;
      }
    }

    let enemyToAdd: enemy.Enemy | null = null;

    for (let data of this.gameData) {
      // FIXME: ???
      // Move all the enemies down.
      for (let enemy of data.enemies) {
        enemy.move(0.0025 * data.enemySpeedCoefficient);
        if (enemy.sPosition <= 0) {
          enemy.remove(data, 10);
        }
      }
      if (data.baseHealth <= 0) {
        this.startGameOverProcess(data);
      }

      // clocks
      // Add enemy if generated.
      if (
        data.clocks.enemySpawn.currentTime >= data.clocks.enemySpawn.actionTime
      ) {
        enemyToAdd = generateEnemyWithChance(
          data.enemySpawnThreshold,
          this.updateNumber
        );
        data.clocks.enemySpawn.currentTime -= data.clocks.enemySpawn.actionTime;
      }
      if (
        data.clocks.comboResetTime.currentTime >=
        data.clocks.comboResetTime.actionTime
      ) {
        data.combo = -1;
        data.clocks.comboResetTime.currentTime -=
          data.clocks.comboResetTime.actionTime;
      }
      if (enemyToAdd) {
        data.enemiesSpawned++;
        data.enemies.push(_.clone(enemyToAdd as enemy.Enemy));
      }
    }
    this.updateNumber++;
  }

  start() {
    if (
      this.mode === GameMode.EasySingleplayer ||
      this.mode === GameMode.StandardSingleplayer
    ) {
      for (let member of this.memberConnectionIDs) {
        this.gameData.push(new SingleplayerGameData(member, this.mode));
      }
    }
    this.playing = true;
    log.info(`Room ${this.id} has started play!`);
  }

  startGameOverProcess(data: GameData) {
    let socket = universal.getSocketFromConnectionID(data.owner);
    // game over here
    let gameMode: string = "";
    switch (data.mode) {
      case GameMode.EasySingleplayer: {
        gameMode = "Easy Singleplayer";
        break;
      }
      case GameMode.StandardSingleplayer: {
        gameMode = "Standard Singleplayer";
        break;
      }
    }
    data.commands.updateText = [
      {
        selector: "#main-content__game-over-screen__stats__score",
        newText: data.score.toString()
      },
      {
        selector: "#main-content__game-over-screen__stats__game-mode",
        newText: gameMode
      },
      {
        selector: "#main-content__game-over-screen__stats__enemies",
        newText: `Enemies: ${data.enemiesKilled}/${data.enemiesSpawned} (${(
          (data.enemiesKilled / data.elapsedTime) *
          1000
        ).toFixed(3)}/s)`
      },
      {
        selector: "#main-content__game-over-screen__stats__time",
        newText: utilities.millisecondsToTime(data.elapsedTime)
      }
    ];
    data.commands.changeScreenTo = "gameOver";
    // destroy room somehow
    this.playing = false;

    if (socket) {
      socket?.unsubscribe(this.id);
      this.deleteMember(socket?.connectionID as string);
    }
  }

  addMember(connectionID: string) {
    if (
      this.memberConnectionIDs.indexOf(connectionID) === -1 &&
      this.spectatorConnectionIDs.indexOf(connectionID) === -1
    ) {
      this.memberConnectionIDs.push(connectionID);
    }
  }

  addSpectator(connectionID: string) {
    if (
      this.spectatorConnectionIDs.indexOf(connectionID) === -1 &&
      this.memberConnectionIDs.indexOf(connectionID) === -1
    ) {
      this.spectatorConnectionIDs.push(connectionID);
    }
  }

  deleteMember(connectionID: string) {
    if (this.memberConnectionIDs.indexOf(connectionID) > -1) {
      this.memberConnectionIDs.splice(
        this.memberConnectionIDs.indexOf(connectionID),
        1
      );
    }
  }

  deleteSpectator(connectionID: string) {
    if (this.spectatorConnectionIDs.indexOf(connectionID) > -1) {
      this.spectatorConnectionIDs.splice(
        this.spectatorConnectionIDs.indexOf(connectionID),
        1
      );
    }
  }
}
class SingleplayerRoom extends Room {
  constructor(hostConnectionID: string, mode: GameMode) {
    super(hostConnectionID, mode);
  }

  update(): void {
    // Update for all types of rooms
    super.update();
  }
}

function generateRoomID(length: number): string {
  let pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let current = "";
  while (
    current === "" ||
    utilities.checkIfPropertyWithValueExists(
      universal.rooms,
      "connectionID",
      current
    )
  ) {
    for (let i = 0; i < length; i++) {
      current += pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return current;
}

function generateEnemyWithChance(
  threshold: number,
  updateNumber: number
): enemy.Enemy | null {
  let roll: number = Math.random();
  if (roll < threshold) {
    return enemy.createNew(enemy.EnemyType.NORMAL, `G${updateNumber}`);
  }
  return null;
}

function processKeypressForRoom(connectionID: string, code: string) {
  let roomToProcess = utilities.findRoomWithConnectionID(connectionID, false);
  let inputInformation: InputActionInterface = {
    action: InputAction.Unknown,
    argument: ""
  };
  if (!roomToProcess) {
    return;
  }
  let gameDataToProcess = utilities.findGameDataWithConnectionID(
    connectionID,
    roomToProcess
  );
  if (!gameDataToProcess) {
    return;
  }
  // TODO: Refactor this.
  // find the type of room input
  inputInformation = input.getInputInformation(code);
  if (inputInformation.action !== InputAction.Unknown) {
    input.processInputInformation(inputInformation, gameDataToProcess);
  }
}
export {
  SingleplayerRoom,
  Room,
  GameData,
  SingleplayerGameData,
  processKeypressForRoom,
  GameMode
};
