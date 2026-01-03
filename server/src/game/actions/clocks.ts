// package files
import _ from "lodash";
// other files
import { Enemy, createNewEnemy } from "../Enemy";
import { GameData } from "../GameData";
import { Room } from "../Room";
import { findRoomWithConnectionID } from "../../core/utilities";
import { MultiplayerRoom } from "../MultiplayerRoom";

/**
 * Check all Singleplayer room clocks.
 * @param {GameData} data The data to reference to/from.
 * @param {Room} room The room of the data.
 */
function checkSingleplayerRoomClocks(data: GameData, room: Room) {
  checkEnemyTimeClocks(data, room);
  checkComboTimeClock(data);
  checkBaseHealthRegenerationClock(data);
}

function checkPlayerMultiplayerRoomClocks(data: GameData) {
  checkComboTimeClock(data);
}

/**
 * Checks all GLOBAL Multiplayer Room clocks.
 * @param {MultiplayerRoom} room The room to check the clocks against.
 */
function checkGlobalMultiplayerRoomClocks(room: MultiplayerRoom) {
  room.globalEnemyToAdd = null;
  const enemyToAdd: Enemy = createNewEnemy(`G${room.updateNumber}`);
  const forcedEnemySpawnClock = room.globalClock.forcedEnemySpawn;
  const enemySpawnClock = room.globalClock.enemySpawn;
  let forcedSpawned = false;

  if (forcedEnemySpawnClock.currentTime >= forcedEnemySpawnClock.actionTime) {
    room.globalEnemyToAdd = _.cloneDeep(enemyToAdd);
    forcedEnemySpawnClock.currentTime -= forcedEnemySpawnClock.actionTime;
    // reset time
    forcedSpawned = true;
    forcedEnemySpawnClock.currentTime = 0;
  }

  // Add enemy if generated.
  if (enemySpawnClock.currentTime >= enemySpawnClock.actionTime) {
    const roll = Math.random();
    if (roll < room.globalEnemySpawnThreshold && !forcedSpawned) {
      room.globalEnemyToAdd = _.clone(enemyToAdd);
    }
    enemySpawnClock.currentTime -= enemySpawnClock.actionTime;
  }
}

/**
 * Check enemy time clocks, and adds an enemy if conditions are met.
 * @param {GameData} data The data to reference to/from.
 * @param {Room} room The room of the data.
 */
function checkEnemyTimeClocks(data: GameData, room: Room) {
  const enemyToAdd: Enemy = createNewEnemy(`G${room.updateNumber}`);
  const forcedEnemySpawnClock = data.clocks.forcedEnemySpawn;
  const enemySpawnClock = data.clocks.enemySpawn;
  let forcedSpawned = false;

  // Add enemy if forced time up
  // forced enemy clock
  if (forcedEnemySpawnClock.currentTime >= forcedEnemySpawnClock.actionTime) {
    // forcibly spawn enemy
    data.enemies.push(_.clone(enemyToAdd));
    room.gameActionRecord.addEnemySpawnAction(enemyToAdd, data);
    forcedSpawned = true;
    // reset time
    forcedEnemySpawnClock.currentTime = 0;
    data.enemiesSpawned++;
  }

  // regular enemy clock
  if (enemySpawnClock.currentTime >= enemySpawnClock.actionTime) {
    const roll = Math.random();
    if (roll < data.enemySpawnThreshold && !forcedSpawned) {
      data.enemies.push(_.clone(enemyToAdd));
      room.gameActionRecord.addEnemySpawnAction(enemyToAdd, data);
      data.enemiesSpawned++;
    }
    enemySpawnClock.currentTime -= enemySpawnClock.actionTime;
    forcedEnemySpawnClock.currentTime = 0;
  }
}

/**
 * Checks the clock for combo time.
 * Should work for both Singleplayer and Multiplayer rooms.
 */
function checkComboTimeClock(data: GameData) {
  const comboResetClock = data.clocks.comboReset;
  if (comboResetClock.currentTime >= comboResetClock.actionTime) {
    data.combo = -1;
    comboResetClock.currentTime -= comboResetClock.actionTime;
    // send game data as well
    const room = findRoomWithConnectionID(data.ownerConnectionID);
    if (room) {
      room.gameActionRecord.addSetGameDataAction(data, "player", "combo", -1);
    }
  }
}

/**
 * Checks the clock for base health regeneration time.
 * Should work for both Singleplayer and Multiplayer rooms.
 */
function checkBaseHealthRegenerationClock(data: GameData) {
  const baseHealthHealClock = data.clocks.regenerateBaseHealth;
  if (
    baseHealthHealClock.currentTime >= baseHealthHealClock.actionTime &&
    data.baseHealth > 0
  ) {
    const baseHealthNow = addToBaseHealth(data);
    const room = findRoomWithConnectionID(
      data.owner.getUserData().connectionID
    );
    room?.gameActionRecord.addSetGameDataAction(
      data,
      "player",
      "baseHealth",
      baseHealthNow
    );
    baseHealthHealClock.currentTime -= baseHealthHealClock.actionTime;
  }
}

function addToBaseHealth(data: GameData) {
  data.baseHealth = Math.min(
    data.baseHealth + data.baseHealthRegeneration,
    data.maximumBaseHealth
  );
  return data.baseHealth;
}

export {
  checkSingleplayerRoomClocks,
  checkGlobalMultiplayerRoomClocks,
  checkPlayerMultiplayerRoomClocks
};
