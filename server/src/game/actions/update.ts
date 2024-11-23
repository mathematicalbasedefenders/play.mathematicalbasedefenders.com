// packages
import * as _ from "lodash";
// other files
import { SingleplayerRoom } from "../Room";
import { checkSingleplayerRoomClocks } from "./clocks";
import { GameData } from "../GameData";

function updateSingleplayerRoomData(room: SingleplayerRoom, deltaTime: number) {
  for (const data of room.gameData) {
    // Move all the enemies down.
    moveEnemies(data, deltaTime);

    // game over?
    checkGameOverCondition(data, room);

    // clocks
    checkSingleplayerRoomClocks(data, room);
  }
}

function moveEnemies(data: GameData, deltaTime: number) {
  const BASE_ENEMY_SPEED = 0.1;
  const MILLISECONDS_IN_A_SECOND = 1000;
  const BASE_ENEMY_ATTACK = 10;

  for (const enemy of data.enemies) {
    const distance =
      BASE_ENEMY_SPEED *
      data.enemySpeedCoefficient *
      (deltaTime / MILLISECONDS_IN_A_SECOND);
    enemy.move(distance);
    if (enemy.sPosition <= 0) {
      enemy.attackBase(data, BASE_ENEMY_ATTACK);
    }
  }
}

/**
 * Checks if a singleplayer room's attributes constitutes for a game over.
 * @param {GameData} data The data of the room.
 * @param {SingleplayerRoom} room The room.
 */
function checkGameOverCondition(data: GameData, room: SingleplayerRoom) {
  if (data.baseHealth <= 0) {
    room.startGameOverProcess(data);
  }
}

export { updateSingleplayerRoomData };
