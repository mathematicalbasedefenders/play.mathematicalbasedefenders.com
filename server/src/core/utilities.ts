import * as universal from "../universal";
import { log } from "./log";
import { Room } from "../game/Room";
import { User, UserInterface } from "../models/User";
import _ from "lodash";
import { GameData, GameMode } from "../game/GameData";
// Highest comes first
const RANK_ORDER = [
  ["Developer", "isDeveloper"],
  ["Administrator", "isAdministrator"],
  ["Moderator", "isModerator"],
  ["Contributor", "isContributor"],
  ["Tester", "isTester"],
  ["Donator", "isDonator"]
];

const MESSAGES_PER_SECOND_TIME_PERIOD = 200;
let timePeriodPassedForMessageSpeed = 0;
const MESSAGES_PER_SECOND_LIMIT = 500;

const SINGLEPLAYER_CUSTOM_SETTINGS_BOUNDARIES: { [key: string]: any } = {
  baseHealth: {
    type: "number",
    minimum: 1,
    maximum: 10000 * 10
  },
  comboTime: {
    type: "number",
    minimum: 0,
    maximum: 60 * 60 * 1000
  },
  enemySpeedCoefficient: {
    type: "number",
    minimum: 0.25,
    maximum: 50
  },
  enemySpawnTime: {
    type: "number",
    minimum: 0,
    maximum: 60 * 1000
  },
  enemySpawnChance: {
    type: "number",
    minimum: 0,
    maximum: 1
  },
  forcedEnemySpawnTime: {
    type: "number",
    minimum: 0,
    maximum: 60 * 1000
  }
};

function checkIfPropertyWithValueExists(
  dataset: unknown,
  targetProperty: string,
  targetValue: string
) {
  if (Array.isArray(dataset)) {
    for (let i = 0; i < dataset.length; i++) {
      try {
        if (dataset[i][targetProperty] === targetValue) {
          return true;
        }
        // TODO: this is temporary failsafe
      } catch (error: any) {
        log.error(error.stack);
        return false;
      }
    }
  }
  return false;
}

function findGameDataWithConnectionID(connectionID: string, room?: Room) {
  // if room is defined, function jumps to finding game data from that room.
  if (!room) {
    log.warn(
      "Finding game data for a connection ID with an unknown room is not supported yet."
    );
    return null;
  }
  for (let gameData of room.gameData) {
    if (gameData.ownerConnectionID === connectionID) {
      return gameData;
    }
  }
  return null;
}

function generateRankingText(rankingData: Array<any>) {
  let reversed = rankingData.reverse();
  let result = "";
  for (let record of reversed) {
    result += `#${record.placement} ${record.name} ${record.time}ms ${record.sent}S/${record.received}R`;
    result += `<br>`;
  }
  return result;
}

function findRoomWithConnectionID(
  connectionID: string | undefined,
  countSpectatorsToo?: boolean
) {
  if (typeof connectionID === "undefined") {
    return null;
  }
  for (let room in universal.rooms) {
    if (countSpectatorsToo) {
      if (
        universal.rooms[room].memberConnectionIDs.indexOf(connectionID) > -1 ||
        universal.rooms[room].spectatorConnectionIDs.indexOf(connectionID) > -1
      ) {
        return universal.rooms[room];
      }
    } else {
      if (
        universal.rooms[room].memberConnectionIDs.indexOf(connectionID) > -1
      ) {
        return universal.rooms[room];
      }
    }
  }
  return null;
}
function millisecondsToTime(milliseconds: number) {
  let m = Math.floor(milliseconds / 60000);
  let s = Math.floor((milliseconds % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  let ms = Math.floor((milliseconds % 60000) % 1000)
    .toString()
    .padStart(3, "0");
  return `${m}:${s}.${ms}`;
}

function getRank(data: UserInterface | string | undefined) {
  if (typeof data === "undefined") {
    return { title: "", color: "#ffffff" };
  }
  if (typeof data === "string") {
    // Custom rank
    return { title: data, color: "#ffffff" };
  }
  if (data.membership.isDeveloper) {
    return { title: "Developer", color: "#ff0000" };
  }
  if (data.membership.isAdministrator) {
    return { title: "Administrator", color: "#da1717" };
  }
  if (data.membership.isModerator) {
    return { title: "Moderator", color: "#ff7f00" };
  }
  if (data.membership.isContributor) {
    return { title: "Contributor", color: "#01acff" };
  }
  if (data.membership.isTester) {
    return { title: "Tester", color: "#5bb1e0" };
  }
  if (data.membership.isDonator) {
    return { title: "Donator", color: "#26e02c" };
  }
  // No rank
  return { title: "", color: "#ffffff" };
}

// adapted from https://stackoverflow.com/a/56294043/11855065
function mutatedArrayFilter(array: Array<unknown>, callback: Function) {
  for (let i = array.length - 1; i >= 0; i -= 1) {
    if (!callback(array[i])) array.splice(i, 1);
  }
}

function generatePlayerListText(connections: Array<string>) {
  let text = "";
  for (let connection of connections) {
    let socket = universal.getSocketFromConnectionID(connection);
    let color = socket?.playerRank?.color || "#ffffff";
    let name = universal.getNameFromConnectionID(connection);
    text += `<span style="color:${color};">${name}</span>`;
    text += "<br>";
  }
  return text;
}

function validateCustomGameSettings(
  mode: string,
  settings: { [key: string]: string }
) {
  if (mode !== "singleplayer") {
    return {
      success: false,
      reason: `Unknown mode: ${mode}`
    };
  }
  let ok = true;
  let errors = [];
  for (let key in settings) {
    let restriction = SINGLEPLAYER_CUSTOM_SETTINGS_BOUNDARIES[key];
    // FIXME: as any unsafe
    let parsedValue = !isNaN(settings[key] as any)
      ? parseFloat(settings[key])
      : settings[key];
    if (typeof parsedValue !== restriction.type) {
      errors.push(
        `Wrong type in ${key}: got ${typeof parsedValue}, but expected ${
          restriction.type
        }.`
      );
      ok = false;
      continue;
    }
    // check numbers
    if (restriction.type === "number") {
      if (
        !(
          parsedValue >= restriction.minimum &&
          parsedValue <= restriction.maximum
        )
      ) {
        errors.push(
          `Value too high or too low in ${key}: got ${parsedValue}, but only allowed a number between ${restriction.minimum} and ${restriction.maximum}, inclusive.`
        );
        ok = false;
        continue;
      }
    }
  }
  if (!ok) {
    log.warn(
      `Unable to start custom singleplayer game for a socket: ${errors.join(
        " "
      )}`
    );
    return {
      success: false,
      reason: `Error: ${errors.join(" ")}`
    };
  }
  return {
    success: ok
  };
}

function minifySelfGameData(gameData: { [key: string]: any }) {
  // delete unnecessary keys
  delete gameData.totalEnemiesReceived;
  delete gameData.totalEnemiesSent;
  // minify enemies
  for (let enemy in gameData.enemies) {
    // delete unnecessary keys
    delete gameData.enemies[enemy].requestedValue;
    // round off values
    gameData.enemies[enemy].xPosition = parseFloat(
      gameData.enemies[enemy].xPosition.toFixed(3)
    );
    gameData.enemies[enemy].sPosition = parseFloat(
      gameData.enemies[enemy].sPosition.toFixed(3)
    );
  }
}

function generateConnectionID(length: number) {
  let pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let current = "";
  while (
    current === "" ||
    checkIfPropertyWithValueExists(universal.sockets, "connectionID", current)
  ) {
    for (let i = 0; i < length; i++) {
      current += pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return current;
}

function generateGuestID(length: number) {
  let pool = "0123456789";
  let current = "";
  while (
    current === "" ||
    checkIfPropertyWithValueExists(universal.sockets, "ownerGuestID", current)
  ) {
    for (let i = 0; i < length; i++) {
      current += pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return current;
}

/**
 * TODO: Move this to somewhere else.
 * Updates the client-side on-screen data for the socket with said socket's info.
 * @param {GameSocket} socket The socket to get data from and to update to
 */
async function updateSocketUserInformation(socket: universal.GameSocket) {
  const userData = await User.safeFindByUsername(
    socket.ownerUsername as string
  );
  socket.send(
    JSON.stringify({
      message: "updateUserInformationText",
      data: {
        username: socket.ownerUsername,
        good: true,
        userData: userData,
        rank: getRank(userData),
        experiencePoints: userData.statistics.totalExperiencePoints,
        records: {
          easy: userData.statistics.personalBestScoreOnEasySingleplayerMode,
          standard:
            userData.statistics.personalBestScoreOnStandardSingleplayerMode
        },
        // TODO: Refactor this
        reason: "All checks passed."
      }
    })
  );
}

async function bulkUpdateSocketUserInformation(
  ...sockets: Array<universal.GameSocket | undefined>
) {
  for (const socket of sockets) {
    if (socket && socket.loggedIn) {
      updateSocketUserInformation(socket);
    }
  }
}

function createGlobalLeaderboardsMessage(data: GameData, rank: number) {
  const toReturn: { [key: string]: any } = {};
  let modeName = "";
  switch (data.mode) {
    case GameMode.EasySingleplayer: {
      modeName = "Easy Singleplayer";
      break;
    }
    case GameMode.StandardSingleplayer: {
      modeName = "Standard Singleplayer";
      break;
    }
  }
  toReturn.text = `${data.ownerName} has achieved #${rank} on the ${modeName} leaderboards with a score of ${data.score} points.`;
  toReturn.borderColor = "#ab93db";
  return toReturn;
}

/**
 * Derives the number of messages a `GameSocket` will send per 1000ms from the socket and the time passed now.
 * @param {GameSocket} socket The socket to check the speed of.
 * @param {number} time The time period of the speed.
 * @returns How many messages the GameSocket would have sent as if 1000ms has passed,
 * or -1 if socket doesn't have the `accumulatedMessages` property.
 */
function getWebSocketMessageSpeed(socket: universal.GameSocket, time: number) {
  if (typeof socket.accumulatedMessages === "number") {
    return (1000 / Math.max(15, time)) * socket.accumulatedMessages;
  }
  return -1;
}

/**
 *
 */
function checkWebSocketMessageSpeeds(
  sockets: Array<universal.GameSocket>,
  time: number
) {
  timePeriodPassedForMessageSpeed += time;
  // here incase Nms is too low (e.g. 1 msg. in 1ms => 1000 msg./s => disconnect)
  if (timePeriodPassedForMessageSpeed < MESSAGES_PER_SECOND_TIME_PERIOD) {
    return;
  }
  const socketsToForceDelete = [];
  for (const socket of sockets) {
    if (typeof socket.accumulatedMessages === "number") {
      const amount = getWebSocketMessageSpeed(socket, time);
      if (amount > MESSAGES_PER_SECOND_LIMIT) {
        log.warn(
          `Disconnecting socket ${socket.connectionID} for sending too many messages at once. (${amount} per second > ${MESSAGES_PER_SECOND_LIMIT} per second)`
        );
        socket?.send(
          JSON.stringify({
            message: "createToastNotification",
            // TODO: Refactor this
            text: `You're going too fast! You have been immediately disconnected.`,
            borderColor: "#ff0000"
          })
        );
        socketsToForceDelete.push(socket);
      } else {
        socket.accumulatedMessages = 0;
      }
    }
  }
  for (const socket of socketsToForceDelete) {
    universal.forceDeleteAndCloseSocket(socket);
  }
  // modulo instead of subtract because it doesn't get check multiple times.
  timePeriodPassedForMessageSpeed %= MESSAGES_PER_SECOND_TIME_PERIOD;
}

// Taken from https://stackoverflow.com/a/39914235
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export {
  checkIfPropertyWithValueExists,
  findRoomWithConnectionID,
  findGameDataWithConnectionID,
  millisecondsToTime,
  getRank,
  generateRankingText,
  mutatedArrayFilter,
  generatePlayerListText,
  validateCustomGameSettings,
  minifySelfGameData,
  generateConnectionID,
  generateGuestID,
  updateSocketUserInformation,
  bulkUpdateSocketUserInformation,
  sleep,
  createGlobalLeaderboardsMessage,
  getWebSocketMessageSpeed,
  checkWebSocketMessageSpeeds
};
