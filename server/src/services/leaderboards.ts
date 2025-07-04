import { log } from "../core/log";
import { GameMode } from "../game/Room";
import { User } from "../models/User";

/**
 * Gets the top 100 scores of a specified Singleplayer game mode.
 * Note that the real leaderboards where users can see is on the accompanying website
 * @param {GameMode | string} gameMode The game mode to get scores of.
 * @returns The scores of the top 100 players
 */
async function getScoresOfAllPlayers(gameMode: GameMode | string) {
  let startTime = Date.now();
  let key = "";
  let players: Array<any> = [];
  switch (gameMode) {
    case GameMode.EasySingleplayer: {
      key = "Easy";
      players = await User.getEasySingleplayerBestScores(100);
      break;
    }
    case GameMode.StandardSingleplayer: {
      key = "Standard";
      players = await User.getStandardSingleplayerBestScores(100);
      break;
    }
  }
  log.info(`Starting ${key} score querying.`);
  const filtered = players.filter(
    // TODO: For now, but it works, so don't touch it!
    (element: any) =>
      typeof element[`statistics`][
        `personalBestScoreOn${key}SingleplayerMode`
      ] !== "undefined"
  );
  log.info(`${key} score querying took ${Date.now() - startTime}ms`);
  return filtered;
}

export { getScoresOfAllPlayers };
