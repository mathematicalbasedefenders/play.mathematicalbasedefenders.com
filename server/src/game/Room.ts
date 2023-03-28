import * as utilities from "../core/utilities";
import * as universal from "../universal";
import * as enemy from "./Enemy";
import * as _ from "lodash";
import { log } from "../core/log";
import * as input from "../core/input";
import { submitSingleplayerGame } from "../services/score";
import { InputAction } from "../core/input";

const NO_HOST_ID = "(no host)";
// TODO: Change design
let defaultMultiplayerRoomID: string | null = null;

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
  aborted: boolean;
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
    this.aborted = false;
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
      this.enemySpawnThreshold = 0.1;
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

class MultiplayerGameData extends GameData {
  // nothing here yet...

  constructor(owner: string, gameMode: GameMode) {
    if (
      !(
        gameMode === GameMode.DefaultMultiplayer ||
        gameMode === GameMode.CustomMultiplayer
      )
    ) {
      log.error(
        "Non-multiplayer game mode passed as argument in a multiplayer room."
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
  constructor(hostConnectionID: string, gameMode: GameMode, noHost?: boolean) {
    this.mode = gameMode;
    this.id = generateRoomID(8);
    if (noHost) {
      // should only be used for default multiplayer
      this.hostConnectionID = NO_HOST_ID;
    } else {
      this.hostConnectionID = hostConnectionID;
    }

    this.addMember(hostConnectionID);
    this.lastUpdateTime = Date.now();

    // special for default multiplayer
    // check if default multiplayer room already exists
    if (gameMode === GameMode.DefaultMultiplayer && defaultMultiplayerRoomID) {
      log.warn(`There may only be one Default Multiplayer room at at time.`);
      log.warn(
        `A Default Multiplayer room with ID ${defaultMultiplayerRoomID} already exists.`
      );
      this.destroy();
      return;
    } else if (gameMode === GameMode.DefaultMultiplayer) {
      defaultMultiplayerRoomID = this.id;
    }

    log.info(`Created ${gameMode} room with ID ${this.id}`);
  }

  update(deltaTime: number) {
    if (!this.playing) {
      return;
    }

    for (let i = 0; i < this.gameData.length; i++) {
      this.gameData[i].elapsedTime += deltaTime;
      for (let clock in this.gameData[i].clocks) {
        this.gameData[i].clocks[clock].currentTime += deltaTime;
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
    } else if (
      this.mode === GameMode.DefaultMultiplayer ||
      this.mode === GameMode.CustomMultiplayer
    ) {
      for (let member of this.memberConnectionIDs) {
        this.gameData.push(new MultiplayerGameData(member, this.mode));
      }
    }
    this.playing = true;
    log.info(`Room ${this.id} has started play!`);
  }

  // TODO: Move this to singleplayer room
  async startGameOverProcess(data: GameData) {
    let socket = universal.getSocketFromConnectionID(data.owner);
    let messages = "";
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

    if (
      data.mode === GameMode.EasySingleplayer ||
      data.mode === GameMode.StandardSingleplayer
    ) {
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
        },
        {
          selector: "#main-content__game-over-screen__stats__score-rank",
          newText: messages
        }
      ];
      data.commands.changeScreenTo = "gameOver";
      // submit score
      if (socket) {
        submitSingleplayerGame(data, socket);
      }
      // destroy room somehow
      this.playing = false;
      if (socket) {
        socket?.unsubscribe(this.id);
        this.deleteMember(socket?.connectionID as string);
      }
    }
  }

  addMember(connectionID: string) {
    if (
      this.memberConnectionIDs.indexOf(connectionID) === -1 &&
      this.spectatorConnectionIDs.indexOf(connectionID) === -1
    ) {
      this.memberConnectionIDs.push(connectionID);
      log.info(
        `Added socket with connection ID ${connectionID} as a member to room ${this.id}`
      );
    }
  }

  addSpectator(connectionID: string) {
    if (
      this.spectatorConnectionIDs.indexOf(connectionID) === -1 &&
      this.memberConnectionIDs.indexOf(connectionID) === -1
    ) {
      this.spectatorConnectionIDs.push(connectionID);
      log.info(
        `Added socket with connection ID ${connectionID} as a spectator to room ${this.id}`
      );
    }
  }

  deleteMember(connectionID: string) {
    if (this.memberConnectionIDs.indexOf(connectionID) > -1) {
      this.memberConnectionIDs.splice(
        this.memberConnectionIDs.indexOf(connectionID),
        1
      );
      log.info(
        `Deleted socket with connection ID ${connectionID} (member) from room ${this.id}`
      );
    }
  }

  deleteSpectator(connectionID: string) {
    if (this.spectatorConnectionIDs.indexOf(connectionID) > -1) {
      this.spectatorConnectionIDs.splice(
        this.spectatorConnectionIDs.indexOf(connectionID),
        1
      );
      log.info(
        `Deleted socket with connection ID ${connectionID} (spectator) from room ${this.id}`
      );
    }
  }

  // delete all players, then destroy room
  destroy() {
    let members = _.clone(this.memberConnectionIDs);
    let spectators = _.clone(this.spectatorConnectionIDs);
    for (let spectator of spectators) {
      this.deleteMember(spectator);
    }
    for (let member of members) {
      this.deleteMember(member);
    }
  }
}
class SingleplayerRoom extends Room {
  constructor(hostConnectionID: string, mode: GameMode) {
    super(hostConnectionID, mode);
  }

  update(): void {
    // Update for all types of rooms
    let now: number = Date.now();
    let deltaTime: number = now - this.lastUpdateTime;
    super.update(deltaTime);
    this.lastUpdateTime = now;
    // Then update for all singleplayer rooms
    let data = this.gameData[0];
    if (data.aborted) {
      this.abort(data);
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
  }

  abort(data: GameData) {
    let socket = universal.getSocketFromConnectionID(data.owner);
    data.commands.changeScreenTo = "mainMenu";
    this.playing = false;
    if (socket) {
      socket?.unsubscribe(this.id);
      this.deleteMember(socket?.connectionID as string);
    }
  }
}

class MultiplayerRoom extends Room {
  nextGameStartTime!: Date | null;
  globalEnemySpawnThreshold: number;
  globalClock: ClockInterface;

  constructor(hostConnectionID: string, mode: GameMode, noHost: boolean) {
    super(hostConnectionID, mode, noHost);
    this.nextGameStartTime = null;
    this.globalEnemySpawnThreshold = 0.1;
    this.globalClock = {
      enemySpawn: {
        currentTime: 0,
        actionTime: 100
      }
    };
  }

  update(): void {
    // Update for all types of rooms
    let now: number = Date.now();
    let deltaTime: number = now - this.lastUpdateTime;
    super.update(deltaTime);
    this.lastUpdateTime = now;

    // Then update specifically for multiplayer rooms

    if (!this.playing) {
      // Check if there is at least 2 players - if so, start intermission countdown
      if (
        this.nextGameStartTime == null &&
        this.memberConnectionIDs.length >= 2
      ) {
        this.nextGameStartTime = new Date(Date.now() + 1000 * 10);
      }
      // Check if there is less than 2 players - if so, stop intermission countdown
      if (
        this.nextGameStartTime instanceof Date &&
        this.memberConnectionIDs.length < 2
      ) {
        this.nextGameStartTime = null;
      }
      // Start game
      // TODO: Refactor this
      if (this.nextGameStartTime != null) {
        if (new Date() >= this.nextGameStartTime) {
          this.start();
          for (let connectionID of this.memberConnectionIDs) {
            let socket = universal.getSocketFromConnectionID(connectionID);
            if (socket) {
              socket.send(
                JSON.stringify({
                  message: "changeScreen",
                  newScreen: "canvas"
                })
              );
            }
          }
        }
      }
      // Update Text
      for (let connectionID of this.memberConnectionIDs) {
        let socket = universal.getSocketFromConnectionID(connectionID);
        if (socket) {
          if (this.nextGameStartTime) {
            let timeLeft = Math.abs(
              Date.now() - this.nextGameStartTime?.getTime()
            );
            socket.send(
              JSON.stringify({
                message: "changeText",
                selector:
                  "#main-content__multiplayer-intermission-screen-container__game-status-message",
                value: `Next game starting in ${(timeLeft / 1000).toFixed(
                  3
                )} seconds.`
              })
            );
          }
        }
      }
    } else {
      // playing

      // all players

      // global - applies to all players
      let enemyToAdd = null;

      // global clocks
      this.globalClock.enemySpawn.currentTime += deltaTime;
      // Add enemy if generated.

      if (
        this.globalClock.enemySpawn.currentTime >=
        this.globalClock.enemySpawn.actionTime
      ) {
        enemyToAdd = generateEnemyWithChance(
          this.globalEnemySpawnThreshold,
          this.updateNumber
        );
        this.globalClock.enemySpawn.currentTime -=
          this.globalClock.enemySpawn.actionTime;
      }

      // specific to each player
      for (let data of this.gameData) {
        for (let enemy of data.enemies) {
          enemy.move(0.0025 * data.enemySpeedCoefficient);
          if (enemy.sPosition <= 0) {
            enemy.remove(data, 10);
          }
        }
        if (data.baseHealth <= 0) {
          // player is eliminated.
          this.eliminateSocketID(data.owner);
        }

        // clocks
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
    }
  }

  eliminateSocketID(connectionID: string) {
    let socket = universal.getSocketFromConnectionID(connectionID);
    if (typeof socket === "undefined") {
      log.warn(
        `Socket ID ${connectionID} not found while eliminating it from multiplayer room, therefore skipping process.`
      );
      return;
    }
    // eliminate the socket
    let gameDataIndex = this.gameData.findIndex(
      (element) => element.owner === connectionID
    );
    this.gameData.splice(gameDataIndex, 1);
    this.checkIfGameFinished(this.gameData);
  }

  checkIfGameFinished(gameDataArray: Array<GameData>) {
    if (gameDataArray.length <= 1) {
      // game finished
      // Default Multiplayer for now since there's only 1 multiplayer room at a given time.
      log.info(`Default Multiplayer Room has finished playing.`);
      if (gameDataArray.length === 1) {
        log.info(`The winner is socket ID ${gameDataArray[0].owner}`);
      }
    }
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
  MultiplayerRoom,
  Room,
  GameData,
  SingleplayerGameData,
  processKeypressForRoom,
  GameMode,
  defaultMultiplayerRoomID
};
