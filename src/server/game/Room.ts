import * as utilities from "../core/utilities";
import * as universal from "../universal";
import * as enemy from "./Enemy";
import * as _ from "lodash";
import { log } from "../core/log";
import * as input from "../core/input";

const STANDARD_ENEMY_CHANCE: number = 0.5;

enum InputAction {
  Unknown = 0,
  AddDigit = 1,
  RemoveDigit = 2,
  SendAnswer = 3,
  AddSubtractionSign = 4
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
  // ...
  constructor(owner: string) {
    this.score = 0;
    this.enemiesKilled = 0;
    this.enemiesSpawned = 0;
    this.baseHealth = 100;
    this.owner = owner;
    this.enemies = [];
    this.enemiesToErase = [];
    this.clocks = {
      enemySpawn: {
        currentTime: 0,
        actionTime: 100
      }
    };
    this.currentInput = "";
    this.elapsedTime = 0;
  }
}
class SingleplayerGameData extends GameData {
  // nothing here yet...

  constructor(owner: string) {
    super(owner);
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
  constructor(hostConnectionID: string) {
    this.id = generateRoomID(8);
    this.hostConnectionID = hostConnectionID;
    this.memberConnectionIDs.push(hostConnectionID);
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
        enemy.move();
        if (enemy.sPosition <= 0) {
          enemy.remove(data, 10);
        }
      }
      // Add enemy if generated.
      if (
        data.clocks.enemySpawn.currentTime >= data.clocks.enemySpawn.actionTime
      ) {
        enemyToAdd = generateEnemyWithChance(
          STANDARD_ENEMY_CHANCE,
          this.updateNumber
        );
        data.clocks.enemySpawn.currentTime -= data.clocks.enemySpawn.actionTime;
      }
      if (enemyToAdd) {
        data.enemiesSpawned++;
        data.enemies.push(_.clone(enemyToAdd as enemy.Enemy));
      }
    }
    this.updateNumber++;
  }

  start() {
    for (let member of this.memberConnectionIDs) {
      this.gameData.push(new SingleplayerGameData(member));
    }
    this.playing = true;
    log.info(`Room ${this.id} has started play!`);
  }
}
class SingleplayerRoom extends Room {
  constructor(hostConnectionID: string) {
    super(hostConnectionID);
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
  processKeypressForRoom
};
