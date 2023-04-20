import { log } from "../core/log";
import { getScoresOfAllPlayers } from "./leaderboards";
import { GameData, GameMode } from "../game/Room";
import { User } from "../models/User";
import * as universal from "../universal";
// TODO: make this DRY
async function submitSingleplayerGame(
  data: GameData,
  ownerSocket: universal.GameSocket
) {
  let wordedGameMode: string = "";
  let dataKey: string = "";
  // TODO: Make this JSON for more options in the future.
  let rankMessage = "";
  switch (data.mode) {
    case GameMode.EasySingleplayer: {
      wordedGameMode = "Easy Singleplayer";
      dataKey = "easy";
      break;
    }
    case GameMode.StandardSingleplayer: {
      wordedGameMode = "Standard Singleplayer";
      dataKey = "standard";
      break;
    }
    default: {
      // unknown mode - ignore score
      log.info(
        `A score on ${data.mode} mode has been submitted, which is not easy or standard, therefore ignoring.`
      );
      return;
    }
  }
  // check for database availability.
  if (!universal.STATUS.databaseAvailable) {
    log.warn("Database not available. Ignoring score.");
    ownerSocket.send(
      JSON.stringify({
        message: "changeText",
        selector: "#main-content__game-over-screen__stats__score-rank",
        value: "Score not saved. (No database)"
      })
    );
    return;
  }
  if (!ownerSocket.loggedIn) {
    // guest user - ignore score
    log.info(
      `A guest user has submitted a score of ${data.score} on a ${wordedGameMode} game.`
    );
    return;
  }
  // submit score

  // announce
  log.info(
    `User ${ownerSocket.ownerUsername} has submitted a score of ${data.score} on a ${wordedGameMode} game.`
  );

  // TODO: This makes like 5 database calls, reduce this to one pls
  const statistics = await User.safeFindByUserID(
    ownerSocket.ownerUserID as string
  );
  let experiencePointCoefficient = 0;
  switch (data.mode) {
    case GameMode.EasySingleplayer: {
      if (
        // FIXME: WTF???
        data.score >
        statistics.statistics.personalBestScoreOnEasySingleplayerMode.score
      ) {
        await updatePersonalBest(ownerSocket, data);
        log.info(
          `User ${ownerSocket.ownerUsername} has also achieved a new personal best on Easy Singleplayer with that score.`
        );
        rankMessage += "Personal Best! ";
      }
      experiencePointCoefficient = 0.3;
      break;
    }
    case GameMode.StandardSingleplayer: {
      if (
        data.score >
        statistics.statistics.personalBestScoreOnStandardSingleplayerMode.score
      ) {
        await updatePersonalBest(ownerSocket, data);
        log.info(
          `User ${ownerSocket.ownerUsername} has also achieved a new personal best on Standard Singleplayer with that score.`
        );
        rankMessage += "Personal Best! ";
      }
      experiencePointCoefficient = 1;
      break;
    }
  }
  // give experience points

  // guest users already ignored - no need to actually check for data
  let earned = Math.round(experiencePointCoefficient * (data.score / 100));
  User.giveExperiencePointsToUserID(ownerSocket.ownerUserID as string, earned);
  User.addGamesPlayedToUserID(ownerSocket.ownerUserID as string, 1);

  // TODO: Leaderboards
  let playerRecords = await getScoresOfAllPlayers(data.mode);
  let globalRank = playerRecords.findIndex(
    (element) => element._id.toString() === ownerSocket.ownerUserID
  );

  if (globalRank > -1) {
    rankMessage += `Global Rank #${globalRank + 1}`;
    log.info(
      `User ${ownerSocket.ownerUsername} has also placed #${
        globalRank + 1
      } on the ${wordedGameMode} with that score.`
    );
  }
  ownerSocket.send(
    JSON.stringify({
      message: "changeText",
      selector: "#main-content__game-over-screen__stats__score-rank",
      value: rankMessage
    })
  );
}

async function updatePersonalBest(
  owner: universal.GameSocket | string,
  newData: GameData
) {
  if (typeof owner === "string") {
    // TODO: change to socket
    return;
  }
  let playerData = await User.safeFindByUserID(owner.ownerUserID as string);
  switch (newData.mode) {
    case GameMode.EasySingleplayer: {
      playerData.statistics.personalBestScoreOnEasySingleplayerMode.score =
        newData.score;
      playerData.statistics.personalBestScoreOnEasySingleplayerMode.timeInMilliseconds =
        newData.elapsedTime;
      playerData.statistics.personalBestScoreOnEasySingleplayerMode.scoreSubmissionDateAndTime =
        new Date();
      playerData.statistics.personalBestScoreOnEasySingleplayerMode.enemiesCreated =
        newData.enemiesSpawned;
      playerData.statistics.personalBestScoreOnEasySingleplayerMode.enemiesKilled =
        newData.enemiesKilled;
      break;
    }
    case GameMode.StandardSingleplayer: {
      playerData.statistics.personalBestScoreOnStandardSingleplayerMode.score =
        newData.score;
      playerData.statistics.personalBestScoreOnStandardSingleplayerMode.timeInMilliseconds =
        newData.elapsedTime;
      playerData.statistics.personalBestScoreOnStandardSingleplayerMode.scoreSubmissionDateAndTime =
        new Date();
      playerData.statistics.personalBestScoreOnStandardSingleplayerMode.enemiesCreated =
        newData.enemiesSpawned;
      playerData.statistics.personalBestScoreOnStandardSingleplayerMode.enemiesKilled =
        newData.enemiesKilled;

      break;
    }
  }
  await playerData.save();
}

export { submitSingleplayerGame };
