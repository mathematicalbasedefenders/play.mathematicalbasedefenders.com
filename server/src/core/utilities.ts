import * as universal from "../universal";
import { log } from "./log";
import { Room } from "../game/Room";
import { User, UserInterface } from "../models/User";
import _ from "lodash";
import { GameData, GameMode } from "../game/GameData";

const MESSAGES_PER_SECOND_TIME_PERIOD = 200;
let timePeriodPassedForMessageSpeed = 0;
const MESSAGES_PER_SECOND_LIMIT = 500;
const NUMBER_DECIMAL_PLACES = 3;

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
    minimum: 10,
    maximum: 60 * 1000
  },
  enemySpawnThreshold: {
    type: "number",
    minimum: 0.001,
    maximum: 1
  },
  forcedEnemySpawnTime: {
    type: "number",
    minimum: 10,
    maximum: 60 * 1000
  }
};

// https://stackoverflow.com/questions/52740718/test-if-a-string-is-a-valid-float-in-javascript
const IS_NUMBER_REGEX = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

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

function generateRankingPayload(rankingData: Array<any>) {
  const reversed = rankingData.reverse();
  return reversed.map((record) => ({
    name: record.name,
    placement: record.placement,
    time: record.time,
    sent: record.sent,
    received: record.received,
    nameColor: record.nameColor,
    userID: record.userID,
    isRegistered: record.isRegistered
  }));
}

/**
 * Finds the room where the socket with connectionID `connectionID` is in.
 * @param {string} connectionID The `connectionID` to search on.
 * @param {boolean} considerSpectators Whether to also count spectators as "in the room".
 * @returns The room if found, `null` otherwise.
 */
function findRoomWithConnectionID(
  connectionID: string | undefined,
  considerSpectators?: boolean
) {
  if (typeof connectionID === "undefined") {
    return null;
  }
  for (let room in universal.rooms) {
    if (considerSpectators) {
      if (universal.rooms[room].spectatorConnectionIDs.includes(connectionID)) {
        return universal.rooms[room];
      }
    }
    if (universal.rooms[room].memberConnectionIDs.includes(connectionID)) {
      return universal.rooms[room];
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
    return { title: "Administrator", color: "#ff0000" };
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

function validateCustomGameSettings(
  mode: string,
  settings: { [key: string]: string | number }
) {
  if (mode !== "singleplayer" && mode !== "multiplayer") {
    return {
      success: false,
      reason: `Unknown mode: ${mode}`
    };
  }
  let ok = true;
  const errors = [];
  console.debug(settings);
  for (const key in settings) {
    const restriction = SINGLEPLAYER_CUSTOM_SETTINGS_BOUNDARIES[key];
    // check numbers
    const parsedValue = settings[key].toString();
    if (!restriction) {
      log.warn(`${key} doesn't exist as a customizable field for custom mode.`);
      continue;
    }
    if (restriction.type === "number") {
      if (!IS_NUMBER_REGEX.test(parsedValue as string)) {
        errors.push(
          `Wrong type in ${key}: got ${typeof parsedValue}, but expected ${
            restriction.type
          }.`
        );
        ok = false;
        continue;
      }
      const value = Number(parsedValue);
      if (parsedValue < restriction.minimum) {
        errors.push(
          `Value too low in ${key}: got ${value}, but only allowed a number between ${restriction.minimum} and ${restriction.maximum}, inclusive.`
        );
        ok = false;
        continue;
      }
      if (restriction.maximum < parsedValue) {
        errors.push(
          `Value too high in ${key}: got ${value}, but only allowed a number between ${restriction.minimum} and ${restriction.maximum}, inclusive.`
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
  const score = data.score.toLocaleString("en-US");
  toReturn.text = `${data.ownerName} has achieved #${rank} on the ${modeName} leaderboards with a score of ${score} points.`;
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
            options: { borderColor: "#ff0000" }
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

/**
 * Calculates the actions per minute (player speed) for the player.
 * @param {number} actions The actions in game
 * @param {number} elapsedTime The milliseconds elapsed in the game
 * @returns APM
 */
function calculateAPM(actions: number, elapsedTime: number) {
  const MILLISECONDS_IN_MINUTES = 60000;
  return (actions / elapsedTime) * MILLISECONDS_IN_MINUTES;
}

/**
 * Formats the number (ideally floats) according to the game's conventions.
 * en-US locale, 3 decimal places.
 */
function formatNumber(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: NUMBER_DECIMAL_PLACES,
    maximumFractionDigits: NUMBER_DECIMAL_PLACES
  });
}

function generatePlayerListPayload(connectionIDs: string[]) {
  return connectionIDs.map((connectionID) => {
    const socket = universal.getSocketFromConnectionID(connectionID);
    const color = socket?.playerRank?.color || "#ffffff";
    const userID = socket?.ownerUserID;
    const isRegistered = userID != null;
    return {
      name: universal.getNameFromConnectionID(connectionID),
      color: color,
      userID: userID ?? null,
      isRegistered: isRegistered
    };
  });
}

/**
 * This function returns only necessary data to construct a replay
 * file from player data from a socket.
 * Use this for replays.
 * @param socket The socket.
 * @returns The parsed data.
 */
function getUserReplayDataFromSocket(socket: universal.GameSocket) {
  return {
    userID: socket.loggedIn ? socket.ownerUserID : null,
    name: socket.loggedIn ? socket.ownerUsername : socket.ownerGuestName,
    isAuthenticated: socket.loggedIn,
    connectionID: socket.connectionID
  };
}

/**
 * Converts game settings to "replay actions"
 * This is so that when opening a replay, the game settings (e.g. enemy speed) match up
 * for more accurate replays.
 * @param {GameData} data The data of the game to convert.
 * @returns Replay actions, one for each setting. e.g., enemySpeed is now 1
 */
function convertGameSettingsToReplayActions(data: GameData) {
  const result: { [key: string]: any } = {};
  const keys = keyify(data);
  for (const key of keys) {
    result[key] = _.get(data, key);
  }
  return result;
}

/**
 * Gets the currently available multiplayer rooms available
 * for use with the public room list.
 */
function getHumanFriendlyMultiplayerRoomList() {
  const rooms = universal.rooms.filter(
    (e) => e.mode === GameMode.CustomMultiplayer
  );
  const result: Array<unknown> = [];
  for (const room of rooms) {
    if (!room.host) {
      continue;
    }
    const formattedRoom = {
      id: room.id,
      playerCount: room.memberConnectionIDs.length,
      spectatorCount: room.spectatorConnectionIDs.length,
      name: ""
    };
    // TODO: Quite a hacky way to do this, find a "better" way.
    const hostName =
      universal.getNameFromConnectionID(room.host.connectionID as string) ??
      "(unknown)";
    formattedRoom.name = `Multiplayer room with ID ${room.id} hosted by ${hostName} with ${formattedRoom.playerCount} players.`;
    result.push(formattedRoom);
  }
  return result;
}

const keyify = (obj: any, prefix = ""): string[] => {
  const keys: string[] = [];
  Object.keys(obj).forEach((el) => {
    if (typeof obj[el] === "object" && obj[el] !== null) {
      keys.push(...keyify(obj[el], `${prefix}${el}.`));
    } else {
      keys.push(`${prefix}${el}`);
    }
  });
  return keys;
};

export {
  checkIfPropertyWithValueExists,
  findRoomWithConnectionID,
  findGameDataWithConnectionID,
  millisecondsToTime,
  getRank,
  generateRankingPayload,
  mutatedArrayFilter,
  generatePlayerListPayload,
  validateCustomGameSettings,
  minifySelfGameData,
  generateConnectionID,
  generateGuestID,
  updateSocketUserInformation,
  bulkUpdateSocketUserInformation,
  sleep,
  createGlobalLeaderboardsMessage,
  getWebSocketMessageSpeed,
  checkWebSocketMessageSpeeds,
  calculateAPM,
  formatNumber,
  getUserReplayDataFromSocket,
  convertGameSettingsToReplayActions,
  getHumanFriendlyMultiplayerRoomList
};
