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
// TODO: make this DRY
async function submitSingleplayerGame(data: GameData, owner: GameSocket) {
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
    default: {
      // unknown mode - ignore score
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

  // announce
  log.info(
    `${owner.ownerUsername} submitted a score of ${data.score} on ${wordedGameMode}`
  );

  // TODO: This makes like 5 database calls, reduce this to one pls
  const statistics = await User.safeFindByUserID(owner.ownerUserID as string);
  switch (data.mode) {
    case GameMode.EasySingleplayer: {
      const key = "personalBestScoreOnEasySingleplayerMode";
      if (data.score > (statistics.statistics[key].score || -1)) {
        await updatePersonalBest(owner, data);
        log.info(`New Easy Singleplayer PB for ${owner.ownerUsername}.`);
        rankMessage += "Personal Best! ";
        personalBestBeaten = true;
      }
      break;
    }
    case GameMode.StandardSingleplayer: {
      const key = "personalBestScoreOnStandardSingleplayerMode";
      if (data.score > (statistics.statistics[key].score || -1)) {
        await updatePersonalBest(owner, data);
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
      sendDiscordWebhook(data, rank);
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
 * Leaderboard ranks are announced if the player made top 100, regardless if the score was a new PB.
 * @param {GameSocket} owner The socket of the GameData's owner.
 * @param {GameData} data The GameData of which the new personal best was acquired.
 * @returns -1 if not in Top 100 of game mode, rank number otherwise.
 */
async function getLeaderboardsRank(owner: GameSocket, data: GameData) {
  const records = await getScoresOfAllPlayers(data.mode);
  const globalRank = records.findIndex(
    (r) => r._id.toString() === owner.ownerUserID
  );
  if (globalRank > -1) {
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
async function updatePersonalBest(owner: GameSocket, newData: GameData) {
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
      break;
    }
  }
  await playerData.save();
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
