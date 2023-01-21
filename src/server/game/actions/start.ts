import { Enemy } from "../../core/Enemy";
import * as enemy from "../../core/Enemy";

enum SingleplayerGameMode {
  EASY = 1,
  STANDARD = 2,
  CUSTOM = 3
}

type SingleplayerGameParameters = {
  mode: SingleplayerGameMode;
  data: {
    game: {
      baseHealth: number;
      combo: number;
      score: number;
      enemies: {
        stock: Array<Enemy>;
        onField: Array<Enemy>;
      };
      enemySpeedMultiplier: number;
    };
  };
};

function startSingleplayerGame(
  roomID: string,
  parameters: SingleplayerGameParameters
) {}
