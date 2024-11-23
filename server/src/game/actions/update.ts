// packages
import * as _ from "lodash";
// other files
import { SingleplayerRoom } from "../Room";
import { checkSingleplayerRoomClocks } from "./clocks";

const BASE_ENEMY_SPEED = 0.1;
const MILLISECONDS_IN_A_SECOND = 1000;

const BASE_DAMAGE = 10;

function updateSingleplayerRoomData(room: SingleplayerRoom, deltaTime: number) {
  for (let data of room.gameData) {
    // Move all the enemies down.
    for (const enemy of data.enemies) {
      const distance =
        BASE_ENEMY_SPEED *
        data.enemySpeedCoefficient *
        (deltaTime / MILLISECONDS_IN_A_SECOND);
      enemy.move(distance);
      if (enemy.sPosition <= 0) {
        enemy.attackBase(data, BASE_DAMAGE);
      }
    }

    if (data.baseHealth <= 0) {
      room.startGameOverProcess(data);
    }

    // clocks
    checkSingleplayerRoomClocks(data, room);
  }
}

export { updateSingleplayerRoomData };
