import { GameData } from "../GameData";
import * as utilities from "../../core/utilities";
function createGameOverScreenText(data: GameData, gameMode: string) {
  let messages = "";
  const toReturn = [
    {
      value: {
        selector: "#main-content__game-over-screen__stats__score",
        newText: data.score.toLocaleString("en-US")
      },
      age: 0
    },
    {
      value: {
        selector: "#main-content__game-over-screen__stats__game-mode",
        newText: gameMode
      },
      age: 0
    },
    {
      value: {
        selector: "#main-content__game-over-screen__stats__enemies",
        newText: (() => {
          const killed = data.enemiesKilled.toLocaleString("en-US");
          const spawned = data.enemiesSpawned.toLocaleString("en-US");
          const killsPerSecond = (
            (data.enemiesKilled / data.elapsedTime) *
            1000
          ).toFixed(3);
          return `Enemies: ${killed}/${spawned} (${killsPerSecond}/s)`;
        })()
      },
      age: 0
    },
    {
      value: {
        selector: "#main-content__game-over-screen__stats__time",
        newText: utilities.millisecondsToTime(data.elapsedTime)
      },
      age: 0
    },
    {
      value: {
        selector: "#main-content__game-over-screen__stats__score-rank",
        newText: messages
      },
      age: 0
    },
    {
      value: {
        selector: "#main-content__game-over-screen__stats__level",
        newText: `${data.level} (${data.enemiesToNextLevel} to next)`
      },
      age: 0
    },
    {
      value: {
        selector: "#main-content__game-over-screen__stats__actions",
        newText: `${utilities
          .calculateAPM(data.actionsPerformed, data.elapsedTime)
          .toFixed(3)}APM`
      },
      age: 0
    }
  ];
  return toReturn;
}

export { createGameOverScreenText };
