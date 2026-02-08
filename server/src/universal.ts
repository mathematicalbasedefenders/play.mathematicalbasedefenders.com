import { WebSocket } from "uWebSockets.js";
import { getOpponentsInformation } from "./game/Room";
import { GameData, GameMode } from "./game/GameData";
import _ from "lodash";
import {
  minifySelfGameData,
  findRoomWithConnectionID,
  generateGuestID,
  generateConnectionID
} from "./core/utilities";
import { log } from "./core/log";
import { validateCustomGameSettings } from "./core/utilities";
import fs from "node:fs";
import path from "node:path";
import { MultiplayerRoom } from "./game/MultiplayerRoom";
import {
  SingleplayerRoom,
  createSingleplayerRoom
} from "./game/SingleplayerRoom";
import { ToastNotificationData } from "./core/toast-notifications";
// 0.4.10
// TODO: Rewrite to adhere to new uWS.js version.
interface UserData {
  /** Owner's username. If exists, overrides `ownerGuestName` */
  ownerUsername?: string;
  /** Owner's USER ID. */
  ownerUserID?: string;
  /** Owner's guest name. Can be overwritten with username by logging in. */
  ownerGuestName: string;
  /** Socket's connectionID, randomly generated between sessions. */
  connectionID: string;
  /** Whether a socket is logged in. */
  loggedIn: boolean;
  /** Player rank of a socket */
  playerRank: PlayerRank;
  /** These are used for rate limiting. */
  accumulatedMessages: number;
  /** These are used for rate limiting. */
  rateLimiting: {
    last: number;
    count: number;
  };
  /**
   * Whether the owner of the socket exited the opening screen.
   * Once exited opening screen, no further authentication attempts can be performed.
   * New in 0.4.13.
   */
  exitedOpeningScreen?: boolean;

  /**
   * Tears down the socket, disconnecting itself from
   * the game and deleting itself from memory.
   * @returns `true` If socket is successfully deleted without errors, `false` otherwise.
   */
  teardown(): boolean;

  /**
   * "Forcefully" tears down the socket, disconnecting
   * itself from the game and deleting itself from memory.
   * This method is meant to be a more "unsafe" way of
   * disconnecting a socket.
   * @returns `true` If socket is successfully deleted without errors, `false` otherwise.
   */
  forceTeardown(): boolean;

  /**
   * Synchronizes the socket's server-side GAME data
   * TO client-side data.
   */
  synchronizeToClientSide(): void;

  /**
   * Synchronizes the server's METADATA to
   * client-side data.
   */
  synchronizeMetadataToClientSide(
    deltaTime: number,
    systemStatus: object
  ): void;

  sendToastNotification(data: ToastNotificationData): void;
}

type PlayerRank = {
  color: string;
  title: string;
};

const sockets: Array<WebSocket<UserData>> = [];
const rooms: Array<SingleplayerRoom | MultiplayerRoom> = [];

const STATUS = {
  databaseAvailable: false,
  lastDeltaTimeToUpdate: 0,
  gameVersion: process.env.npm_package_version ?? "0.5.0-rc.8"
};

/**
 * Initializes a socket. This includes adding it subscribing it to `game`.
 * @param {WebSocket<UserData>} socket The socket to initialize default values with.
 */
function initializeSocket(socket: WebSocket<UserData>) {
  const socketUserData = socket.getUserData();
  socketUserData.exitedOpeningScreen = false;
  socketUserData.connectionID = generateConnectionID(16);
  socketUserData.ownerGuestName = `Guest ${generateGuestID(8)}`;
  socketUserData.accumulatedMessages = 0;
  socketUserData.rateLimiting = {
    last: 1,
    count: 0
  };

  // interface methods
  socketUserData.teardown = function () {
    return deleteSocket(socket);
  };

  socketUserData.forceTeardown = function () {
    return forceDeleteAndCloseSocket(socket);
  };

  socketUserData.synchronizeToClientSide = function () {
    return synchronizeGameDataWithSocket(socket);
  };

  socketUserData.synchronizeMetadataToClientSide = function (
    deltaTime,
    systemStatus
  ) {
    return synchronizeMetadataWithSocket(socket, deltaTime, systemStatus);
  };

  socket.subscribe("game");
}

/**
 * Removes the socket from memory.
 * @param {WebSocket<UserData>} socketToClose The socket to remove.
 */
function deleteSocket(socketToClose: WebSocket<UserData>) {
  // update room that socket is in
  const socketConnectionID = socketToClose.getUserData().connectionID;
  if (typeof socketConnectionID !== "string") {
    return false;
  }
  // delete the socket
  const connectionID = socketToClose.getUserData().connectionID;
  const room = rooms.find(
    (room) =>
      room.memberConnectionIDs.indexOf(
        socketToClose.getUserData().connectionID as string
      ) > -1
  );
  if (room) {
    room.deleteMember(socketToClose);
    // If room that socket is in is a multiplayer room, eliminate it too.
    if (room instanceof MultiplayerRoom) {
      const gameData = getGameDataFromConnectionID(connectionID);
      room.eliminateSocketID(connectionID, gameData ?? {});
    }
  }
  const socketToDeleteIndex: number = sockets.indexOf(socketToClose);
  if (socketToDeleteIndex > -1) {
    sockets.splice(socketToDeleteIndex, 1);
  }
  log.info(`Socket with ID ${socketConnectionID} has disconnected!`);
  return true;
}

function forceDeleteAndCloseSocket(socketToClose: WebSocket<UserData>) {
  log.warn(
    `Forcing deleting+closing socket ID ${
      socketToClose.getUserData().connectionID
    }`
  );
  const socketToDeleteIndex: number = sockets.indexOf(socketToClose);
  if (socketToDeleteIndex > -1) {
    sockets.splice(socketToDeleteIndex, 1);
  }
  socketToClose?.close();
  return true;
}

/**
 * Attempts to find the socket with the ID `id`.
 * @param {string} id The ID of the socket to find.
 * @returns The `WebSocket<UserData>` if such ID exists, `undefined` otherwise.
 */
function getSocketFromConnectionID(id: string) {
  return sockets.find((socket) => socket.getUserData().connectionID === id);
}

/**
 * Attempts to find the socket with the ID `id`.
 * @param {string} id The ID of the socket to find.
 * @returns The `WebSocket<UserData>` if such ID exists, `undefined` otherwise.
 */
function getSocketsFromUserID(id: string) {
  return sockets.filter((socket) => socket.getUserData().ownerUserID === id);
}

function getNameFromConnectionID(id: string): string | undefined {
  const socket = getSocketFromConnectionID(id);
  if (typeof socket === "undefined") {
    return "???";
  }
  const socketUserData = socket.getUserData();
  if (socketUserData.loggedIn) {
    return socketUserData.ownerUsername;
  } else {
    return socketUserData.ownerGuestName;
  }
}

/**
 * Attempts to find the game data tied to the ID `id`.
 * @param {string} id The ID of the socket to find the game data of.
 * @returns The `GameData` if such ID exists, `null` otherwise.
 */
function getGameDataFromConnectionID(id: string): GameData | null {
  for (let room of rooms) {
    if (room) {
      for (let data of room.gameData) {
        if (data.ownerConnectionID === id) {
          return data;
        }
      }
    }
  }
  return null;
}

/**
 * Checks if the socket is in game.
 * This uses another function to check for `GameData`.
 * This assumes that all playing sockets have a `GameData` associated to it,
 * and all non-playing sockets don't. This isn't really a good idea.
 * TODO: Create a separate variable/function/etc. that doesn't depend on whether
 * the socket has `GameData` tied to it.
 * @param {string} id The ID of the socket to see if playing.
 * @returns `true` if the socket is in game, `false` otherwise.
 */
function checkIfSocketIsPlaying(id: string) {
  return getGameDataFromConnectionID(id) != null;
}

function checkIfSocketIsInMultiplayerRoom(id: string) {
  const room = findRoomWithConnectionID(id);
  if (!room) {
    return false;
  }
  if (room.mode !== "defaultMultiplayer" && room.mode !== "customMultiplayer") {
    return false;
  }
  return true;
}

/**
 * Synchronizes the game data of the server from the server-side to the client-side.
 * @param {WebSocket<UserData>} socket The socket to sync data with.
 */
function synchronizeMetadataWithSocket(
  socket: WebSocket<UserData>,
  deltaTime: number,
  systemStatus: { [key: string]: any }
) {
  // server metadata
  STATUS.lastDeltaTimeToUpdate = deltaTime;
  const metadataToSend = getServerMetadata(deltaTime, systemStatus);
  const socketID = socket?.getUserData().connectionID;
  if (socketID) {
    metadataToSend.playerName = getNameFromConnectionID(socketID) ?? "???";
  }
  socket.send(
    JSON.stringify({
      message: "updateServerMetadata",
      data: metadataToSend
    })
  );
  // socket metadata
  const socketUserData = socket.getUserData();
  if (socketUserData.connectionID) {
    const id = socketUserData.connectionID;
    const socketIsPlaying = checkIfSocketIsPlaying(id);
    const socketIsInMPRoom = checkIfSocketIsInMultiplayerRoom(id);
    socket.send(
      JSON.stringify({
        message: "updateSocketMetadata",
        data: {
          playing: socketIsPlaying,
          inMultiplayerRoom: socketIsInMPRoom
        }
      })
    );
  }
}

/**
 * Synchronizes the game data of the socket from the server-side to the client-side.
 * @param {WebSocket<UserData>} socket The socket to sync data with.
 */
function synchronizeGameDataWithSocket(socket: WebSocket<UserData>) {
  const socketUserData = socket.getUserData();
  const socketGameData = getGameDataFromConnectionID(
    socketUserData.connectionID as string
  );
  const clonedSocketGameData = _.cloneDeep(socketGameData);
  if (clonedSocketGameData) {
    clonedSocketGameData.timestampOfSynchronization = Date.now();
    // remove some game data
    minifySelfGameData(clonedSocketGameData);
    // add some game data (extra information)
    // such as for multiplayer
    if (clonedSocketGameData.mode.indexOf("Multiplayer") > -1) {
      let room = findRoomWithConnectionID(socketUserData.connectionID);
      if (room) {
        clonedSocketGameData.opponentGameData = getOpponentsInformation(
          socket,
          room,
          true
        );
      }
    }
    let gameDataToSend = JSON.stringify(clonedSocketGameData);
    socket.send(
      JSON.stringify({
        message: "renderGameData",
        data: gameDataToSend
      })
    );
    // other commands
    for (let commandType in clonedSocketGameData.commands) {
      // TODO: imperfect
      for (let command in clonedSocketGameData.commands[commandType]) {
        if (
          typeof clonedSocketGameData.commands[commandType][command].age ===
          "undefined"
        ) {
          clonedSocketGameData.commands[commandType][command].age = 0;
        } else {
          clonedSocketGameData.commands[commandType][command].age += 1;
          if (clonedSocketGameData.commands[commandType][command].age >= 3) {
            delete clonedSocketGameData.commands[commandType][command];
          }
        }
      }
    }
  }
}

/**
 * Gets the server's metadata.
 */
function getServerMetadata(
  deltaTime: number,
  systemStatus: { [key: string]: any }
) {
  // number of rooms
  const online = sockets.length;
  const onlineRegistered = sockets.filter(
    (e) => e.getUserData().loggedIn
  ).length;
  const onlineGuests = online - onlineRegistered;
  const roomsTotal = rooms.length;
  // TODO: Change this when custom singleplayer comes
  const roomsMulti =
    rooms.filter(
      (e) => e.mode === "defaultMultiplayer" || e.mode === "customMultiplayer"
    ).length || 0;
  const roomsSingle = roomsTotal - roomsMulti;
  // system usage status
  const osUsageLevel = systemStatus.os.level;
  const osUsageToShow = osUsageLevel > 0 ? systemStatus.os.usage : -1;
  const updateTimeLevel = systemStatus.updateTime.level;
  const updateTimeToShow =
    updateTimeLevel > 0 ? systemStatus.updateTime.time : -1;
  return {
    onlineTotal: online,
    onlineRegistered: onlineRegistered,
    onlineGuests: onlineGuests,
    roomsTotal: roomsTotal,
    roomsMulti: roomsMulti,
    roomsSingle: roomsSingle,
    lastUpdated: deltaTime,
    osUsageLevel: osUsageLevel,
    osUsageToShow: osUsageToShow,
    updateTimeLevel: updateTimeLevel,
    updateTimeToShow: updateTimeToShow,
    playerName: "???",
    playerRank: "???",
    playerLevel: "???"
  };
}

/**
 * Sends a global toast notification to everyone, regardless of logged in/out.
 * @param settings Settings to the sent global toast notification.
 */
function sendGlobalToastNotification(options: { [key: string]: any }) {
  for (const socket of sockets) {
    if (socket) {
      socket.send(
        // TODO: Refactor this?
        JSON.stringify({
          message: "createToastNotification",
          text: options.text,
          options: options
        })
      );
    }
  }
}

/**
 * Sends a message to every socket connected, regardless of logged in/out
 * @param message The message.
 */
function sendGlobalWebSocketMessage(message: { [key: string]: any } | string) {
  for (const socket of sockets) {
    if (socket) {
      if (typeof message === "string") {
        socket.send(message);
      } else {
        socket.send(
          JSON.stringify({
            message
          })
        );
      }
    }
  }
}

/**
 * This sends data to the socket's connection to update initial values.
 * @param {WebSocket<UserData>} socket The socket to initialize send data to.
 */
function sendInitialSocketData(socket: WebSocket<UserData>) {
  const socketUserData = socket.getUserData();
  socket.send(
    JSON.stringify({
      message: "changeValueOfInput",
      selector: "#authentication-modal__socket-id",
      value: socketUserData.connectionID
    })
  );
  socket.send(
    JSON.stringify({
      message: "updateGuestInformationText",
      data: {
        guestName: socketUserData.ownerGuestName
      }
    })
  );
}

// TODO: This can only set borderColor, which is all we need, I guess...
function sendToastMessageToSocket(
  socket: WebSocket<UserData>,
  data: ToastNotificationData
) {
  socket?.send(
    JSON.stringify({
      message: "createToastNotification",
      text: data.text,
      options: { borderColor: data.borderColor }
    })
  );
}

function startGameForSocket(
  socket: WebSocket<UserData>,
  parsedMessage: { [key: string]: string }
) {
  switch (parsedMessage.mode) {
    case "singleplayer": {
      switch (parsedMessage.modifier) {
        case "easy": {
          const room = createSingleplayerRoom(
            socket,
            GameMode.EasySingleplayer
          );
          room.addMember(socket);
          room.startPlay();
          break;
        }
        case "standard": {
          const room = createSingleplayerRoom(
            socket,
            GameMode.StandardSingleplayer
          );
          room.addMember(socket);
          room.startPlay();
          break;
        }
        case "custom": {
          const validationResult = validateCustomGameSettings(
            parsedMessage.mode,
            JSON.parse(parsedMessage.settings)
          );
          if (!validationResult.success) {
            // send error message
            socket.send(
              JSON.stringify({
                message: "changeText",
                selector:
                  "#main-content__custom-singleplayer-intermission-screen-container__errors",
                value: validationResult.reason
              })
            );
            return;
          }
          const room = createSingleplayerRoom(
            socket,
            GameMode.CustomSingleplayer,
            JSON.parse(parsedMessage.settings)
          );
          room.addMember(socket);
          room.startPlay();
          socket.send(
            JSON.stringify({
              message: "changeText",
              selector:
                "#main-content__custom-singleplayer-intermission-screen-container__errors",
              value: ""
            })
          );
          socket.send(
            JSON.stringify({
              message: "changeScreen",
              newScreen: "canvas"
            })
          );
          break;
        }
        default: {
          log.warn(`Unknown singleplayer game mode: ${parsedMessage.modifier}`);
          break;
        }
      }
      break;
    }
    default: {
      log.warn(`Unknown game mode: ${parsedMessage.mode}`);
      break;
    }
  }
}

// get configuration
const configurationLocation = path.join(
  __dirname,
  "..",
  "mathematical-base-defenders-server-configuration.json"
);
const CONFIGURATION = JSON.parse(
  fs.readFileSync(configurationLocation, "utf-8")
);
/**
 * Use testing values (e.g. fixed numbers) if BOTH
 * process.env.NODE_ENV is NOT production and flag
 * in configuration file is turned on.
 */
const USE_TESTING_VALUES =
  process.env.NODE_ENV !== "production" &&
  CONFIGURATION.useTestingStatesIfDevelopmentEnvironment;

export {
  sockets,
  rooms,
  getSocketFromConnectionID,
  getGameDataFromConnectionID,
  getNameFromConnectionID,
  getSocketsFromUserID,
  STATUS,
  sendGlobalToastNotification,
  sendGlobalWebSocketMessage,
  checkIfSocketIsPlaying,
  initializeSocket,
  sendInitialSocketData,
  sendToastMessageToSocket,
  startGameForSocket,
  USE_TESTING_VALUES,
  UserData,
  WebSocket as GameWebSocket // this is exported as `GameWebSocket` since `WebSocket` might clash with other definitions.
};
