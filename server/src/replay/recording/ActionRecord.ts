import { getUserReplayDataFromSocket } from "../../core/utilities";
import { Enemy } from "../../game/Enemy";
import { GameData } from "../../game/GameData";
import { GameSocket } from "../../universal";
import { GameActionRecord as DatabaseGameActionRecord } from "../../models/GameActionRecord";
import mongoose from "mongoose";
import { log } from "../../core/log";

enum Action {
  /** Direct by player */
  Keypress = "keypress",
  Submit = "submit",

  /** Indirect by player */
  EnemyKill = "enemyKill",
  Attack = "attack",
  StockCancel = "stockCancel",
  StockAdd = "stockAdd",
  StockRelease = "stockRelease",

  /** Events from server */
  EnemyReceive = "enemyReceive",
  EnemySpawn = "enemySpawn",
  EnemyReachedBase = "enemyReachedBase",

  /** "Meta" events */
  GameStart = "gameStart",
  GameOver = "gameOver",
  Elimination = "elimination",
  DeclareWinner = "declareWinner",
  AddUser = "addUser",
  SetGameData = "setGameData"
}

class GameActionRecord {
  actionRecords: Array<ActionRecord>;
  recordingVersion: number;
  gameVersion: string;
  owner: GameSocket | null | undefined;

  constructor() {
    this.recordingVersion = 1;
    // TODO: temp
    this.gameVersion = "0.5.0";
    this.actionRecords = [];
    this.owner = null;
  }

  /**
   * Initializes the recording phase of the log.
   * Should be called when a game starts.
   */
  initialize() {
    this.empty();
    const startActionRecord: ActionRecord = {
      scope: "room",
      action: Action.GameStart,
      timestamp: Date.now(),
      data: {}
    };
    this.addAction(startActionRecord);
  }

  addAction(action: ActionRecord) {
    this.actionRecords.push(action);
  }

  addEnemySpawnAction(
    enemy: Enemy,
    data: GameData,
    isReceived: boolean = false
  ) {
    this.addAction({
      action: isReceived ? Action.EnemyReceive : Action.EnemySpawn,
      scope: "player",
      user: getUserReplayDataFromSocket(data.owner),
      timestamp: Date.now(),
      data: {
        xPosition: enemy.xPosition,
        sPosition: enemy.sPosition,
        speed: enemy.speed,
        displayedText: enemy.displayedText,
        id: enemy.id
      }
    });
  }

  addEnemyKillAction(enemy: Enemy, data: GameData) {
    this.addAction({
      action: Action.EnemyKill,
      scope: "player",
      user: getUserReplayDataFromSocket(data.owner),
      timestamp: Date.now(),
      data: {
        enemyID: enemy.id
      }
    });
  }

  addEnemyReachedBaseAction(enemy: Enemy, data: GameData) {
    this.addAction({
      action: Action.EnemyReachedBase,
      scope: "player",
      user: getUserReplayDataFromSocket(data.owner),
      timestamp: Date.now(),
      data: {
        enemyID: enemy.id
      }
    });
  }

  addSetGameDataAction(
    data: GameData,
    scope: "room" | "player",
    key: string,
    value: string | number
  ) {
    this.addAction({
      action: Action.SetGameData,
      scope: scope,
      user: getUserReplayDataFromSocket(data.owner),
      timestamp: Date.now(),
      data: {
        key: key,
        value: value
      }
    });
  }

  /* For multiplayer */
  addAttackAction(attackerData: GameData, amount: number) {
    this.addAction({
      action: Action.Attack,
      scope: "player",
      user: getUserReplayDataFromSocket(attackerData.owner),
      timestamp: Date.now(),
      data: {
        amount: amount
      }
    });
  }

  /* For multiplayer */
  addStockAddAction(receiverData: GameData, amount: number) {
    this.addAction({
      action: Action.StockAdd,
      scope: "player",
      user: getUserReplayDataFromSocket(receiverData.owner),
      timestamp: Date.now(),
      data: {
        amount: amount
      }
    });
  }

  /* For multiplayer */
  addStockCancelAction(receiverData: GameData, amount: number) {
    this.addAction({
      action: Action.StockCancel,
      scope: "player",
      user: getUserReplayDataFromSocket(receiverData.owner),
      timestamp: Date.now(),
      data: {
        amount: amount
      }
    });
  }

  /* For multiplayer */
  addStockReleaseAction(releaserData: GameData) {
    this.addAction({
      action: Action.StockRelease,
      scope: "player",
      user: getUserReplayDataFromSocket(releaserData.owner),
      timestamp: Date.now(),
      data: {}
    });
  }

  addGameOverAction() {
    this.addAction({
      scope: "room",
      action: Action.GameOver,
      timestamp: Date.now(),
      data: {}
    });
  }

  empty() {
    this.actionRecords = [];
  }

  async save(mode: string, data: GameData | Array<any>) {
    const timestamp = new Date();

    const databaseGameActionRecord = new DatabaseGameActionRecord();
    databaseGameActionRecord.actionRecords = this.actionRecords;
    databaseGameActionRecord.recordingVersion = this.recordingVersion;
    databaseGameActionRecord.gameVersion = this.gameVersion;
    databaseGameActionRecord.owner = this.owner?.ownerUserID
      ? new mongoose.Types.ObjectId(this.owner.ownerUserID as string)
      : null;
    databaseGameActionRecord.mode = mode;
    databaseGameActionRecord.timestamp = timestamp;

    switch (mode) {
      case "easySingleplayer":
      case "standardSingleplayer": {
        if (!(data instanceof GameData)) {
          log.error(
            `Expected type GameData of singleplayer for data argument, got: ${typeof data}`
          );
          log.warn(`Game details of replay aren't saved.`);
          break;
        }
        databaseGameActionRecord.name = `Game on timestamp ${timestamp.toISOString()} played by ${
          this.owner?.ownerUsername
        }`;
        databaseGameActionRecord.statistics.singleplayer = {
          score: data.score,
          timeInMilliseconds: data.elapsedTime,
          scoreSubmissionDateAndTime: timestamp,
          enemiesCreated: data.enemiesSpawned,
          enemiesKilled: data.enemiesKilled,
          actionsPerformed: data.actionsPerformed
        };
        break;
      }
      case "defaultMultiplayer": {
        if (!(data instanceof Array)) {
          log.error(
            `Expected type Array of multiplayer game ranks for data argument, got: ${typeof data}`
          );
          log.warn(`Game details of replay aren't saved.`);
          break;
        }
        databaseGameActionRecord.name = `Default Multiplayer game on timestamp ${timestamp.toISOString()}`;
        databaseGameActionRecord.statistics.multiplayer = {
          ranking: data
        };
        break;
      }
    }

    let replayID = "";

    try {
      const result = await databaseGameActionRecord.save();
      replayID = result._id.toString();
    } catch (error: unknown) {
      if (error instanceof Error) {
        log.error(`Error while saving game recording: ${error.stack}`);
      } else {
        log.error(`Error while saving game recording: ${error}`);
      }
      return { ok: false, id: "" };
    }

    const size = Buffer.byteLength(JSON.stringify(databaseGameActionRecord));
    log.info(`Saved game replay with size ${size} bytes with ID ${replayID}.`);
    return { ok: true, id: replayID };
  }
}

// TODO: remove or `undefined`s
interface ActionRecord {
  scope: "room" | "player";
  user?: {
    userID: string | null | undefined;
    name: string | undefined;
    isAuthenticated: boolean | undefined;
    connectionID: string | undefined;
  };
  action: Action;
  timestamp: number;
  data: { [key: string]: any };
}

export { GameActionRecord, Action, ActionRecord };
