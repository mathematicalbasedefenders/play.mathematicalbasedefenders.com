import { log } from "../core/log";
import { GameData, GameMode } from "../game/Room";
import { User } from "../models/User";
import { GameSocket } from "../universal";

// TODO: make this DRY
async function submitSingleplayerGame(data: GameData, ownerSocket: GameSocket) {
  let gameMode: string = "";
  let dataKey: string = "";
  switch (data.mode) {
    case GameMode.EasySingleplayer: {
      gameMode = "Easy Singleplayer";
      dataKey = "easy";
      break;
    }
    case GameMode.StandardSingleplayer: {
      gameMode = "Standard Singleplayer";
      dataKey = "standard";
      break;
    }
  }
  if (!ownerSocket.loggedIn) {
    // guest user - ignore score
    log.info(
      `A guest user has submitted a score of ${data.score} on a ${gameMode} game.`
    );
    return;
  }
  // submit score

  // announce
  log.info(
    `User ${ownerSocket.username} has submitted a score of ${data.score} on a ${gameMode} game.`
  );

  let playerData = await User.safeFindByUserID(
    ownerSocket.ownerUserID as string
  );
  const statistics = playerData.statistics;
  let experiencePointCoefficient = 0;
  switch (data.mode) {
    case GameMode.EasySingleplayer: {
      if (
        data.score > statistics.personalBestScoreOnEasySingleplayerMode.score
      ) {
        await updatePersonalBest(ownerSocket, data);
      }
      log.info(
        `User ${ownerSocket.username} has also achieved a new personal best with that score.`
      );
      experiencePointCoefficient = 0.3;
      break;
    }
    case GameMode.StandardSingleplayer: {
      if (
        data.score >
        statistics.personalBestScoreOnStandardSingleplayerMode.score
      ) {
        await updatePersonalBest(ownerSocket, data);
      }
      log.info(
        `User ${ownerSocket.username} has also achieved a new personal best with that score.`
      );
      experiencePointCoefficient = 1;
      break;
    }
  }
  // TODO: Leaderboards
}

async function updatePersonalBest(
  owner: GameSocket | string,
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
