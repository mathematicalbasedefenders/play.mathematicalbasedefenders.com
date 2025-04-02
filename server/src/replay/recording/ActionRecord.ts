import { getUserDataFromSocket } from "../../core/utilities";
import { Enemy } from "../../game/Enemy";
import { GameData } from "../../game/GameData";
import { GameSocket } from "../../universal";

enum Action {
  /** Direct by player */
  Keypress = "keypress",
  Submission = "submission",

  /** Indirect by player */
  EnemyKill = "enemyKill",
  EnemySend = "enemySend",
  StockCancel = "stockCancel",
  StockRelease = "stockRelease",

  /** Events from server */
  EnemyReceive = "enemyReceive",
  EnemySpawn = "enemySpawn",
  LevelUp = "levelUp",

  /** "Meta" events */
  GameStart = "gameStart",
  GameOver = "gameOver",
  AddUser = "addUser",
  SetGameData = "setGameData"
}

class GameActionRecord {
  actionRecords: Array<ActionRecord>;
  replayVersion: number;
  gameVersion: string;
  constructor() {
    this.replayVersion = 1;
    // TODO: temp
    this.gameVersion = "0.5.0";
    this.actionRecords = [];
    this.initialize();
  }

  /**
   * Initializes the recording phase of the log.
   * Should be called when a game starts.
   */
  initialize() {
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
