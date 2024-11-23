/**
 * Other stuff
 */
import * as universal from "../universal";
import * as enemy from "./Enemy";
import { log } from "../core/log";

interface ClockInterface {
  [key: string]: {
    currentTime: number;
    actionTime: number;
  };
}

type ActionRecord = {
  action: string;
  timestamp: number;
  data: { [key: string]: any };
};

enum GameMode {
  EasySingleplayer = "easySingleplayer",
  StandardSingleplayer = "standardSingleplayer",
  InsaneSingleplayer = "insaneSingleplayer",
  DefaultMultiplayer = "defaultMultiplayer",
  CustomMultiplayer = "customMultiplayer",
  CustomSingleplayer = "customSingleplayer"
}

/**
 * Extra interface for `CustomGameData`.
 */
interface CustomGameSettings {
  baseHealth: string | number;
  comboTime: string | number;
  enemySpeedCoefficient: string | number;
  enemySpawnTime: string | number;
  enemySpawnThreshold: string | number;
  forcedEnemySpawnTime: string | number;
}

/**
 * Base class for `GameData`.
 */
class GameData {
  score!: number;
  enemiesKilled!: number;
  enemiesSpawned!: number;
  // current enemies on field
  enemies!: Array<enemy.Enemy>;
  baseHealth!: number;
  combo!: number;
  ownerConnectionID: string;
  clocks!: ClockInterface;
  enemiesToErase!: Array<string>;
  currentInput!: string;
  elapsedTime!: number;
  enemySpeedCoefficient!: number;
  commands!: { [key: string]: any };
  mode: string;
  enemySpawnThreshold!: number;
  aborted: boolean;
  totalEnemiesSent!: number;
  totalEnemiesReceived!: number;
  enemiesSentStock!: number;
  opponentGameData!: Array<GameData>;
  ownerName!: string;
  owner: universal.GameSocket;
  // ... (0.4.0)
  level: number;
  enemiesToNextLevel: number;
  baseHealthRegeneration: number;
  maximumBaseHealth: number;
  actionsPerformed: number;
  // ...
  attackScore!: number;
  receivedEnemiesStock!: number;
  receivedEnemiesToSpawn!: number;
  // ... (0.4.10, anticheat)
  actionRecords!: Array<ActionRecord>;
  constructor(owner: universal.GameSocket, mode: GameMode) {
    this.mode = mode;
    this.score = 0;
    this.enemiesKilled = 0;
    this.enemiesSpawned = 0;
    this.baseHealth = 100;
    this.owner = owner;
    this.ownerConnectionID = owner.connectionID as string;
    this.ownerName =
      universal.getNameFromConnectionID(this.ownerConnectionID) || "???";
    this.enemies = [];
    this.enemiesToErase = [];
    this.currentInput = "";
    this.elapsedTime = 0;
    this.combo = -1;
    this.commands = {};
    this.aborted = false;
    this.totalEnemiesSent = 0;
    this.totalEnemiesReceived = 0;
    this.enemiesSentStock = 0;
    this.attackScore = 0;
    this.level = 1;
    this.enemiesToNextLevel = 10;
    this.baseHealthRegeneration = 2;
    this.maximumBaseHealth = 100;
    this.actionsPerformed = 0;
    this.actionRecords = [];
    // per mode
    if (mode === GameMode.EasySingleplayer) {
      this.clocks = {
        enemySpawn: {
          currentTime: 0,
          actionTime: 150 // *0.9875 every level
        },
        forcedEnemySpawn: {
          currentTime: 0,
          actionTime: 7500 // always 2500ms before comboReset actionTime
        },
        comboReset: {
          currentTime: 0,
          actionTime: 10000
        },
        regenerateBaseHealth: {
          currentTime: 0,
          actionTime: 1000
        }
      };
      this.enemySpeedCoefficient = 0.5; // no change
      this.enemySpawnThreshold = 0.075;
    } else {
      this.clocks = {
        enemySpawn: {
          currentTime: 0,
          actionTime: 100 // *0.9875 every level
        },
        forcedEnemySpawn: {
          currentTime: 0,
          actionTime: 2500 // always 2500ms before comboReset actionTime
        },
        comboReset: {
          currentTime: 0,
          actionTime: 5000
        },
        regenerateBaseHealth: {
          currentTime: 0,
          actionTime: 1000
        }
      };
      this.enemySpeedCoefficient = 1; // +0.05 every level
      this.enemySpawnThreshold = 0.1;
    }
  }

  addAction(action: ActionRecord) {
    this.actionRecords.push(action);
  }
}
class SingleplayerGameData extends GameData {
  // nothing here yet...

  constructor(owner: universal.GameSocket, gameMode: GameMode) {
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
    this.actionRecords.push(constructStartGameRecord());
  }

  increaseLevel(amount: number) {
    if (this.mode === GameMode.CustomSingleplayer) {
      log.warn("Levels don't exist in Custom Singleplayer.");
      return;
    }
    for (let i = 0; i < amount; i++) {
      this.level++;
      this.clocks.enemySpawn.actionTime *= 0.9875;
      switch (this.mode) {
        case GameMode.EasySingleplayer: {
          // faster enemies
          this.enemySpeedCoefficient += 0.025;
          // lower base health regeneration
          if (this.baseHealthRegeneration >= 0.2) {
            this.baseHealthRegeneration -= 0.05;
          }
          if (this.baseHealthRegeneration < 0.2) {
            this.baseHealthRegeneration = 0.2;
          }
          break;
        }
        case GameMode.StandardSingleplayer: {
          // faster enemies
          this.enemySpeedCoefficient += 0.05;
          // lower base health regeneration
          if (this.baseHealthRegeneration >= 0.1) {
            this.baseHealthRegeneration -= 0.1;
          }
          if (this.baseHealthRegeneration < 0.1) {
            this.baseHealthRegeneration = 0.1;
          }
          break;
        }
      }
    }
    this.enemiesToNextLevel = 10;
  }
}

class CustomSingleplayerGameData extends GameData {
  constructor(
    owner: universal.GameSocket,
    gameMode: GameMode,
    settings: CustomGameSettings
  ) {
    if (!(gameMode === GameMode.CustomSingleplayer)) {
      log.error(
        "Non-custom singleplayer game mode passed in a custom s.p. room."
      );
      return;
    }
    super(owner, gameMode);
    // This assumes that data has already been validated.
    // FIXME: Remove unnecessary re-conversion to string from number.
    this.baseHealth = Number.parseFloat(settings.baseHealth as string);
    this.maximumBaseHealth = Number.parseFloat(settings.baseHealth as string);
    this.clocks.comboReset.actionTime = Number.parseFloat(
      settings.comboTime as string
    );
    this.enemySpeedCoefficient = Number.parseFloat(
      settings.enemySpeedCoefficient as string
    );
    this.clocks.enemySpawn.actionTime = Number.parseFloat(
      settings.enemySpawnTime as string
    );
    this.enemySpawnThreshold = Number.parseFloat(
      settings.enemySpawnThreshold as string
    );
    this.clocks.forcedEnemySpawn.actionTime = Number.parseFloat(
      settings.forcedEnemySpawnTime as string
    );
  }
}

class MultiplayerGameData extends GameData {
  constructor(owner: universal.GameSocket, gameMode: GameMode) {
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
    this.receivedEnemiesStock = 0;
    this.receivedEnemiesToSpawn = 0;
  }
}

function constructStartGameRecord() {
  const record: ActionRecord = {
    action: "started",
    timestamp: Date.now(),
    data: {}
  };
  return record;
}

export {
  SingleplayerGameData,
  GameData,
  MultiplayerGameData,
  CustomSingleplayerGameData,
  GameMode,
  ClockInterface,
  ActionRecord,
  CustomGameSettings
};
