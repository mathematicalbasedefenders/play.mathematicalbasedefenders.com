import { GameSocket } from "../../universal";

enum Action {
  /** Direct by player */
  Input = "input",
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
  GameOver = "gameOver"
}

class GameActionRecord {
  actionRecords: Array<ActionRecord>;
  version: number;
  constructor() {
    this.version = 1;
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
    this.actionRecords.push();
  }
}

interface ActionRecord {
  scope: "room" | "player";
  user?: {
    userID: string | null;
    name: string;
    isAuthenticated: boolean;
    socket: GameSocket;
  };
  action: Action;
  timestamp: number;
  data: { [key: string]: any };
}

export { GameActionRecord, Action, ActionRecord };
