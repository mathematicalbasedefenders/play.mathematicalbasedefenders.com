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
  baseHealth: number;
  comboTime: number;
  enemySpeedCoefficient: number;
  enemySpawnTime: number;
  enemySpawnThreshold: number;
  forcedEnemySpawnTime: number;
}

const GAME_DATA_CONSTANTS = {
  FORCED_ENEMY_SPAWN_DECREMENT_TIME: 2500,
  ENEMY_SPAWN_ACTION_TIME_MULTIPLIER_ON_LEVEL_UP: 0.9875,
  ENEMIES_PER_LEVEL: 10,
  INITIAL_BASE_HEALTH: 100,
  INITIAL_MAXIMUM_BASE_HEALTH: 100,
  INITIAL_BASE_HEALTH_REGENERATION: 2,

  EASY_SINGLEPLAYER_ENEMY_SPAWN_ACTION_TIME: 150,
  EASY_SINGLEPLAYER_COMBO_RESET_ACTION_TIME: 10000,
  EASY_SINGLEPLAYER_REGENERATE_BASE_HEALTH_ACTION_TIME: 1000,
  EASY_SINGLEPLAYER_ENEMY_STARTING_SPEED_COEFFICIENT: 0.5,
  EASY_SINGLEPLAYER_ENEMY_STARTING_SPAWN_THRESHOLD: 0.075,
  EASY_SINGLEPLAYER_ENEMY_SPEED_COEFFICIENT_INCREMENT: 0.025,
  EASY_SINGLEPLAYER_BASE_HEALTH_REGENERATION_LOWER_LIMIT: 0.2,
  EASY_SINGLEPLAYER_BASE_HEALTH_REGENERATION_DECREMENT: 0.05,

  STANDARD_SINGLEPLAYER_ENEMY_SPAWN_ACTION_TIME: 100,
  STANDARD_SINGLEPLAYER_COMBO_RESET_ACTION_TIME: 5000,
  STANDARD_SINGLEPLAYER_REGENERATE_BASE_HEALTH_ACTION_TIME: 1000,
  STANDARD_SINGLEPLAYER_ENEMY_STARTING_SPEED_COEFFICIENT: 1,
  STANDARD_SINGLEPLAYER_ENEMY_STARTING_SPAWN_THRESHOLD: 0.1,
  STANDARD_SINGLEPLAYER_ENEMY_SPEED_COEFFICIENT_INCREMENT: 0.05,
  STANDARD_SINGLEPLAYER_BASE_HEALTH_REGENERATION_LOWER_LIMIT: 0.1,
  STANDARD_SINGLEPLAYER_BASE_HEALTH_REGENERATION_DECREMENT: 0.1,

  DEFAULT_MULTIPLAYER_GLOBAL_ENEMY_SPAWN_ACTION_TIME: 100,
  DEFAULT_MULTIPLAYER_GLOBAL_ENEMY_STARTING_SPAWN_THRESHOLD: 0.1,
  DEFAULT_MULTIPLAYER_INTERMISSION_TIME: 10000,
  DEFAULT_MULTIPLAYER_MINIMUM_PLAYERS_TO_START: 2,
  DEFAULT_MULTIPLAYER_ENEMY_STARTING_SPEED_COEFFICIENT: 1,
  DEFAULT_MULTIPLAYER_FORCED_ENEMY_SPAWN_ACTION_TIME: 2500
};

/**
 * Base class for `GameData`.
 */
class GameData {
  /**  The current score of the GameData.*/
  score!: number;
  /**  The number of total enemies killed of the GameData.*/
  enemiesKilled!: number;
  /**  The number of total spawn killed of the GameData.*/
  enemiesSpawned!: number;
  /**  An array of the current enemies on the field (through enemy spawn logic.)*/
  enemies!: Array<enemy.Enemy>;
  /**  The GameData's base health.*/
  baseHealth!: number;
  /**  The GameData's combo.*/
  combo!: number;
  /**  The GameData's owner's connection ID.*/
  ownerConnectionID: string;
  /**  The GameData's clock, see `clocks.ts`.*/
  clocks!: ClockInterface;
  /**  Enemies to erase from the `GameData`'s `enemies` property.*/
  enemiesToErase!: Array<string>;
  /**  The current input of the `GameData`.*/
  currentInput!: string;
  /**  How long this `GameData` has been running for.*/
  elapsedTime!: number;
  /**  How fast the enemies move in this `GameData`.*/
  enemySpeedCoefficient!: number;
  /**  The commands for the `GameData`.*/
  commands!: { [key: string]: any };
  /**  The mode for the `GameData`.*/
  mode: string;
  /**  The roll that this `GameData` needs to be lower/higher for an enemy to spawn.*/
  enemySpawnThreshold!: number;
  /**  Whether the `GameData` is aborted.*/
  aborted: boolean;
  /**  (Multiplayer) Number of enemies sent by this `GameData`.*/
  totalEnemiesSent!: number;
  /**  (Multiplayer) Number of enemies received by this `GameData`.*/
  totalEnemiesReceived!: number;
  /**  (Multiplayer) Number of enemies in stock by this `GameData`.*/
  enemiesSentStock!: number;
  /**  (Multiplayer) References(?) to other `GameData` in this `Room` by this `GameData`.*/
  opponentGameData!: Array<GameData>;
  /**  The name to display under the playfield of `GameData`.*/
  ownerName!: string;
  /**  The owner of the `GameData`.*/
  owner: universal.GameSocket;
  // ... (0.4.0)
  /**  The current level this `GameData` is at.*/
  level: number;
  /** The number of enemies this `GameData` needs to kill to go to the next level.*/
  enemiesToNextLevel: number;
  /**  The number of enemies this `GameData` needs to kill to go to the next level.*/
  baseHealthRegeneration: number;
  /**  The cap of this `GameData`'s base health.*/
  maximumBaseHealth: number;
  /**  The total number of actions this `GameData` has performed as.*/
  actionsPerformed: number;
  /**  (Multiplayer) The attack score (total number of enemies sent) of this `GameData`.*/
  attackScore!: number;
  /**  (Multiplayer) The number of enemies in stock waiting to be spawned for deleted from `GameData`.*/
  receivedEnemiesStock!: number;
  /**  (Multiplayer) The number of enemies in stock to be spawned from `GameData`.*/
  receivedEnemiesToSpawn!: number;
  // ... (0.5.0-rc.2)
  /**
   * The timestamp of the last action before sending to socket.
   * Only used for client and server synchronization, never used for internal server calculations.
   */
  timestampOfSynchronization!: number;

  constructor(owner: universal.GameSocket, mode: GameMode) {
    this.mode = mode;
    this.score = 0;
    this.enemiesKilled = 0;
    this.enemiesSpawned = 0;
    this.baseHealth = GAME_DATA_CONSTANTS.INITIAL_BASE_HEALTH;
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
    this.enemiesToNextLevel = GAME_DATA_CONSTANTS.ENEMIES_PER_LEVEL;
    this.baseHealthRegeneration =
      GAME_DATA_CONSTANTS.INITIAL_BASE_HEALTH_REGENERATION;
    this.maximumBaseHealth = GAME_DATA_CONSTANTS.INITIAL_MAXIMUM_BASE_HEALTH;
    this.actionsPerformed = 0;
    // per mode
    if (mode === GameMode.EasySingleplayer) {
      this.clocks = {
        enemySpawn: {
          currentTime: 0,
          actionTime:
            GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_ENEMY_SPAWN_ACTION_TIME // *0.9875 every level
        },
        forcedEnemySpawn: {
          currentTime: 0,
          actionTime:
            GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_COMBO_RESET_ACTION_TIME -
            GAME_DATA_CONSTANTS.FORCED_ENEMY_SPAWN_DECREMENT_TIME // always 2500ms before comboReset actionTime
        },
        comboReset: {
          currentTime: 0,
          actionTime:
            GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_COMBO_RESET_ACTION_TIME
        },
        regenerateBaseHealth: {
          currentTime: 0,
          actionTime:
            GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_REGENERATE_BASE_HEALTH_ACTION_TIME
        }
      };
      this.enemySpeedCoefficient =
        GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_ENEMY_STARTING_SPEED_COEFFICIENT; // no change
      this.enemySpawnThreshold =
        GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_ENEMY_STARTING_SPAWN_THRESHOLD;
    } else {
      this.clocks = {
        enemySpawn: {
          currentTime: 0,
          actionTime:
            GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_ENEMY_SPAWN_ACTION_TIME // *0.9875 every level
        },
        forcedEnemySpawn: {
          currentTime: 0,
          actionTime:
            GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_COMBO_RESET_ACTION_TIME -
            GAME_DATA_CONSTANTS.FORCED_ENEMY_SPAWN_DECREMENT_TIME // always 2500ms before comboReset actionTime
        },
        comboReset: {
          currentTime: 0,
          actionTime:
            GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_COMBO_RESET_ACTION_TIME
        },
        regenerateBaseHealth: {
          currentTime: 0,
          actionTime:
            GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_REGENERATE_BASE_HEALTH_ACTION_TIME
        }
      };
      this.enemySpeedCoefficient =
        GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_ENEMY_STARTING_SPEED_COEFFICIENT; // +0.05 every level
      this.enemySpawnThreshold =
        GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_ENEMY_STARTING_SPAWN_THRESHOLD;
    }
    this.timestampOfSynchronization = Date.now();
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
  }

  increaseLevel(amount: number) {
    if (this.mode === GameMode.CustomSingleplayer) {
      log.warn("Levels don't exist in Custom Singleplayer.");
      return;
    }
    for (let i = 0; i < amount; i++) {
      this.level++;
      this.clocks.enemySpawn.actionTime *=
        GAME_DATA_CONSTANTS.ENEMY_SPAWN_ACTION_TIME_MULTIPLIER_ON_LEVEL_UP;
      switch (this.mode) {
        case GameMode.EasySingleplayer: {
          // faster enemies
          this.enemySpeedCoefficient +=
            GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_ENEMY_SPEED_COEFFICIENT_INCREMENT;
          // lower base health regeneration
          if (
            this.baseHealthRegeneration >=
            GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_BASE_HEALTH_REGENERATION_LOWER_LIMIT
          ) {
            this.baseHealthRegeneration -=
              GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_BASE_HEALTH_REGENERATION_DECREMENT;
          }
          if (
            this.baseHealthRegeneration <
            GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_BASE_HEALTH_REGENERATION_LOWER_LIMIT
          ) {
            this.baseHealthRegeneration =
              GAME_DATA_CONSTANTS.EASY_SINGLEPLAYER_BASE_HEALTH_REGENERATION_LOWER_LIMIT;
          }
          break;
        }
        case GameMode.StandardSingleplayer: {
          // faster enemies
          this.enemySpeedCoefficient +=
            GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_ENEMY_SPEED_COEFFICIENT_INCREMENT;
          // lower base health regeneration
          if (
            this.baseHealthRegeneration >=
            GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_BASE_HEALTH_REGENERATION_LOWER_LIMIT
          ) {
            this.baseHealthRegeneration -=
              GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_BASE_HEALTH_REGENERATION_DECREMENT;
          }
          if (
            this.baseHealthRegeneration <
            GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_BASE_HEALTH_REGENERATION_LOWER_LIMIT
          ) {
            this.baseHealthRegeneration =
              GAME_DATA_CONSTANTS.STANDARD_SINGLEPLAYER_BASE_HEALTH_REGENERATION_DECREMENT;
          }
          break;
        }
      }
    }
    this.enemiesToNextLevel = GAME_DATA_CONSTANTS.ENEMIES_PER_LEVEL;
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
    this.baseHealth = settings.baseHealth;
    this.maximumBaseHealth = settings.baseHealth;
    this.clocks.comboReset.actionTime = settings.comboTime;
    this.enemySpeedCoefficient = settings.enemySpeedCoefficient;
    this.clocks.enemySpawn.actionTime = settings.enemySpawnTime;
    this.enemySpawnThreshold = settings.enemySpawnThreshold;
    this.clocks.forcedEnemySpawn.actionTime = settings.forcedEnemySpawnTime;
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

export {
  SingleplayerGameData,
  GameData,
  MultiplayerGameData,
  CustomSingleplayerGameData,
  GameMode,
  ClockInterface,
  CustomGameSettings,
  GAME_DATA_CONSTANTS
};
