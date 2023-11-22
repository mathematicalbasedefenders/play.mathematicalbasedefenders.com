// package files
import _ from "lodash";
// other files
import { Enemy, createNewEnemy } from "../Enemy";
import { GameData } from "../GameData";
import { Room } from "../Room";

/**
 * Check all Singleplayer room clocks.
 * @param {GameData} data The data to reference to/from.
 * @param {Room} room The room of the data.
 */
function checkSingleplayerRoomClocks(data: GameData, room: Room) {
  checkEnemyTimeClocks(data, room);
  checkComboTimeClock(data);
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
    }
    enemySpawnClock.currentTime -= enemySpawnClock.actionTime;
    forcedEnemySpawnClock.currentTime = 0;
    data.enemiesSpawned++;
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
  }
}

export { checkSingleplayerRoomClocks };
