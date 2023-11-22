// packages
import * as _ from "lodash";
// other files
import { SingleplayerRoom } from "../Room";
import { checkSingleplayerRoomClocks } from "./clocks";

function updateSingleplayerRoomData(room: SingleplayerRoom, deltaTime: number) {
  for (let data of room.gameData) {
    // Move all the enemies down.
    for (let enemy of data.enemies) {
      enemy.move(0.1 * data.enemySpeedCoefficient * (deltaTime / 1000));
      if (enemy.sPosition <= 0) {
        enemy.attackBase(data, 10);
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
