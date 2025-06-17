import { log } from "../core/log";
import { getScoresOfAllPlayers } from "./leaderboards";
import { GameData, GameMode } from "../game/GameData";
import { User } from "../models/User";
import {
  sleep,
  updateSocketUserInformation,
  createGlobalLeaderboardsMessage,
  calculateAPM,
  formatNumber,
  millisecondsToTime
} from "../core/utilities";
import {
  GameSocket,
  STATUS,
  sendGlobalToastNotification,
  sendGlobalWebSocketMessage
} from "../universal";
import { sendDiscordWebhook } from "./discord-webhook";
import { GameActionRecord } from "../replay/recording/ActionRecord";
import mongoose from "mongoose";

// TODO: make this DRY
async function submitSingleplayerGame(
  data: GameData,
  owner: GameSocket,
  gameActionRecord: GameActionRecord
) {
  let wordedGameMode: string = "";
  let dataKey: string = "";
  let personalBestBeaten = false;
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
    case GameMode.CustomSingleplayer: {
      owner.send(
        JSON.stringify({
          message: "changeText",
          selector: "#main-content__game-over-screen__stats__score-replay-id",
          value: `Replay not saved. (Game was on Custom Mode)`
        })
      );
      log.info(`Ignoring score submission on Custom Singleplayer mode.`);
      return;
    }
    default: {
      // unknown mode - ignore score
      owner.send(
        JSON.stringify({
          message: "changeText",
          selector: "#main-content__game-over-screen__stats__score-replay-id",
          value: `Replay not saved. (Game was on unknown mode)`
        })
      );
      log.info(`Ignoring score submission on ${data.mode} Singleplayer mode.`);
      return;
    }
  }
  // check for database availability.
  if (!STATUS.databaseAvailable) {
    log.warn("Database not available. Ignoring score.");
    sendDataToUser(owner, "Score not saved. (No database)");
    return;
  }
  if (!owner.loggedIn) {
    // guest user - ignore score
    log.info(`Ignoring guest score of ${data.score} on ${data.mode} mode`);
    return;
  }

  // save replay
  const replay = await gameActionRecord.save(data.mode, data);

  if (replay.ok) {
    owner.send(
      JSON.stringify({
        message: "changeText",
        selector: "#main-content__game-over-screen__stats__score-replay-id",
        value: `Replay saved with ID ${replay.id}`
      })
    );
  } else {
    owner.send(
      JSON.stringify({
        message: "changeText",
        selector: "#main-content__game-over-screen__stats__score-replay-id",
        value: `Replay not saved.`
      })
    );
  }

  // announce
  log.info(
    `${owner.ownerUsername} submitted a score of ${data.score} on ${wordedGameMode}`
  );

  // TODO: This makes like 5 database calls, reduce this to one pls
  const statistics = await User.safeFindByUserID(owner.ownerUserID as string);
  switch (data.mode) {
    case GameMode.EasySingleplayer: {
      const key = "personalBestScoreOnEasySingleplayerMode";
      const previousBest = statistics?.statistics[key]?.score;
      if (data.score > (previousBest ?? -1)) {
        log.info(`New Easy Singleplayer PB for ${owner.ownerUsername}.`);
        rankMessage += "Personal Best! ";
        personalBestBeaten = true;
      }
      break;
    }
    case GameMode.StandardSingleplayer: {
      const key = "personalBestScoreOnStandardSingleplayerMode";
      const previousBest = statistics?.statistics[key]?.score;
      if (data.score > (previousBest ?? -1)) {
        log.info(`New Standard Singleplayer PB for ${owner.ownerUsername}.`);
        rankMessage += "Personal Best! ";
        personalBestBeaten = true;
      }
      break;
    }
  }

  // give statistics
  // guest users already ignored - no need to actually check for data
  await addToStatistics(owner, data);
  // announce leaderboard rank + send webhook
  const rank = await getLeaderboardsRank(owner, data);
  if (rank > -1) {
    rankMessage += `Global Rank #${rank}`;
    // for webhook sends, also check if record holder beat pb
    if (personalBestBeaten) {
      sendDiscordWebhook(data, rank, replay.id);
      const notification = createGlobalLeaderboardsMessage(data, rank);
      sendGlobalToastNotification(notification);
      const chatAlert = createGlobalChatLeaderboardsMessage(
        data,
        rank,
        owner?.playerRank?.color
      );
      sendRankToGlobalChat(chatAlert);
    }
  }

  /** Update personal bests AFTER announcing leaderboards score */
  if (personalBestBeaten) {
    await updatePersonalBest(owner, data, replay.id);
  }

  // send data to user
  await sendDataToUser(owner, rankMessage);
  // update data on screen
  await sleep(1000);
  await updateSocketUserInformation(owner);
}

/**
 * Gives EXP and GamesPlayed according to Score to the owner of the GameData.
 * @param {GameSocket} owner The socket of the GameData's owner.
 * @param {GameData} data The GameData of which the score was submitted.
 */
async function addToStatistics(owner: GameSocket, data: GameData) {
  const expCoefficient = data.mode === GameMode.EasySingleplayer ? 0.3 : 1;
  const earned = Math.round(expCoefficient * (data.score / 100));
  User.giveExperiencePointsToUserID(owner.ownerUserID as string, earned);
  User.addGamesPlayedToUserID(owner.ownerUserID as string, 1);
}

/**
 * Announces the owner's rank on the leaderboards to the owner of the score and the logs.
 * Leaderboard ranks are announced if the player made top 100, regardless if the score was a new personal best.
 * @param {GameSocket} owner The socket of the GameData's owner.
 * @param {GameData} data The GameData of which the new personal best was acquired.
 * @returns -1 if not in Top 100 of game mode, rank number otherwise.
 */
async function getLeaderboardsRank(owner: GameSocket, data: GameData) {
  const records = await getScoresOfAllPlayers(data.mode);
  let globalRank = -1;
  let key = "";
  switch (data.mode) {
    case GameMode.EasySingleplayer: {
      key = "Easy";
      break;
    }
    case GameMode.StandardSingleplayer: {
      key = "Standard";
      break;
    }
  }
  for (let rank = 0; rank < records.length; rank++) {
    const currentRankScore =
      records[rank][`statistics`][`personalBestScoreOn${key}SingleplayerMode`]
        .score;
    if (data.score > currentRankScore) {
      globalRank = rank;
      break;
    }
  }
  /** if not all 100 spots filled yet, give the new spot */
  if (globalRank === -1 && records.length < 100) {
    /** no +1 here because it gets +1'ed in the return statement */
    globalRank = records.length;
  }
  if (globalRank > -1 && globalRank < 100) {
    log.info(`${owner.ownerUsername} got #${globalRank + 1} on ${data.mode}.`);
    return globalRank + 1;
  }
  return -1;
}

/**
 * Updates the personal best of a registered user.
 * Note that this does not check if the score is actually higher than the previous score.
 * There should be an if statement to check if it's okay to update the score.
 * @param {GameSocket} owner The socket of the GameData's owner.
 * @param {GameData} newData The GameData of which the new personal best was acquired.
 */
async function updatePersonalBest(
  owner: GameSocket,
  newData: GameData,
  replayID: string
) {
  let playerData = await User.safeFindByUserID(owner.ownerUserID as string);
  switch (newData.mode) {
    case GameMode.EasySingleplayer: {
      const key = "personalBestScoreOnEasySingleplayerMode";
      playerData.statistics[key].score = newData.score;
      playerData.statistics[key].timeInMilliseconds = newData.elapsedTime;
      playerData.statistics[key].scoreSubmissionDateAndTime = new Date();
      playerData.statistics[key].enemiesCreated = newData.enemiesSpawned;
      playerData.statistics[key].enemiesKilled = newData.enemiesKilled;
      playerData.statistics[key].actionsPerformed = newData.actionsPerformed;
      playerData.statistics[key].replayID =
        mongoose.Types.ObjectId.createFromHexString(replayID);
      break;
    }
    case GameMode.StandardSingleplayer: {
      const key = "personalBestScoreOnStandardSingleplayerMode";
      playerData.statistics[key].score = newData.score;
      playerData.statistics[key].timeInMilliseconds = newData.elapsedTime;
      playerData.statistics[key].scoreSubmissionDateAndTime = new Date();
      playerData.statistics[key].enemiesCreated = newData.enemiesSpawned;
      playerData.statistics[key].enemiesKilled = newData.enemiesKilled;
      playerData.statistics[key].actionsPerformed = newData.actionsPerformed;
      playerData.statistics[key].replayID =
        mongoose.Types.ObjectId.createFromHexString(replayID);
      break;
    }
  }
  await playerData.save();
  log.info(`Updated PB for user ${owner.ownerUsername} on ${newData.mode}.`);
}

/**
 * Sends a message containing leaderboard rank info to the owner's socket.
 * @param {GameSocket} owner The socket to send the message to.
 * @param {string} message The message to send to the user.
 */
async function sendDataToUser(owner: GameSocket, message: string) {
  owner.send(
    JSON.stringify({
      message: "changeText",
      selector: "#main-content__game-over-screen__stats__score-rank",
      value: message
    })
  );
}

function createGlobalChatLeaderboardsMessage(
  data: GameData,
  rank: number,
  nameColor: string | undefined
) {
  const formattedAPM = formatNumber(
    calculateAPM(data.actionsPerformed, data.elapsedTime)
  );

  const toReturn = {
    message: "addChatMessage",
    data: {
      message: {
        sender: data.ownerName,
        name: data.ownerName,
        mode: data.mode,
        score: data.score.toLocaleString("en-US"),
        apm: formattedAPM,
        rank: rank,
        enemiesKilled: data.enemiesKilled,
        enemiesSpawned: data.enemiesSpawned,
        timeElapsed: millisecondsToTime(data.elapsedTime)
      },
      attribute: "leaderboards",
      location: "#chat-tray-message-container",
      senderColor: nameColor ?? "#ffffff"
    }
  };
  return JSON.stringify(toReturn);
}

function sendRankToGlobalChat(message: { [key: string]: any } | string) {
  sendGlobalWebSocketMessage(message);
}

export { submitSingleplayerGame, sendDataToUser, addToStatistics };
