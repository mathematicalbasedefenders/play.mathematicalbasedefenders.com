import { getUserDataFromSocket } from "../../core/utilities";
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
  Attack = "Attack",
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
    this.initialize();
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

  addEnemySpawnAction(enemy: Enemy, data: GameData, isReceived?: boolean) {
    this.addAction({
      action: isReceived ? Action.EnemyReceive : Action.EnemySpawn,
      scope: "player",
      user: getUserDataFromSocket(data.owner),
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
      user: getUserDataFromSocket(data.owner),
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
      user: getUserDataFromSocket(data.owner),
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
      user: getUserDataFromSocket(data.owner),
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
      user: getUserDataFromSocket(attackerData.owner),
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
      user: getUserDataFromSocket(receiverData.owner),
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
      user: getUserDataFromSocket(receiverData.owner),
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
      user: getUserDataFromSocket(releaserData.owner),
      timestamp: Date.now(),
      data: {}
    });
  }

  empty() {
    this.actionRecords = [];
  }

  async save() {
    const databaseGameActionRecord = new DatabaseGameActionRecord();
    databaseGameActionRecord.actionRecords = this.actionRecords;
    databaseGameActionRecord.recordingVersion = this.recordingVersion;
    databaseGameActionRecord.gameVersion = this.gameVersion;
    databaseGameActionRecord.owner =
      this.owner === null || this.owner === undefined
        ? null
        : new mongoose.Types.ObjectId(this.owner.ownerUserID as string);
    databaseGameActionRecord.name = `Game on timestamp ${new Date()}`;

    try {
      await databaseGameActionRecord.save();
    } catch (error: unknown) {
      if (error instanceof Error) {
        log.error(`Error while saving game recording: ${error.stack}`);
      } else {
        log.error(`Error while saving game recording: ${error}`);
      }
      return;
    }

    const size = Buffer.byteLength(JSON.stringify(databaseGameActionRecord));
    log.info(`Saved game replay with size ${size} bytes.`);
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
    socket?: GameSocket;
  };
  action: Action;
  timestamp: number;
  data: { [key: string]: any };
}

export { GameActionRecord, Action, ActionRecord };
