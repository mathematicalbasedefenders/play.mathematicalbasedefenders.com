import { WebSocket } from "uWebSockets.js";
import {
  SingleplayerRoom,
  MultiplayerRoom,
  getOpponentsInformation,
  Room
} from "./game/Room";
import { GameData, SingleplayerGameData } from "./game/GameData";
import _, { update } from "lodash";
import {
  minifySelfGameData,
  findRoomWithConnectionID,
  checkIfPropertyWithValueExists,
  getRank
} from "./core/utilities";
import { log } from "./core/log";

// 0.4.10
// TODO: Rewrite to adhere to new uWS.js version.
interface UserData {}

type PlayerRank = {
  color: string;
  title: string;
};

type GameSocket = WebSocket<UserData> & {
  /** Owner's username. If exists, overrides `ownerGuestName` */
  ownerUsername?: string;
  /** Owner's USER ID. */
  ownerUserID?: string;
  /** Owner's guest name. Can be overwritten with username by logging in. */
  ownerGuestName?: string;
  /** Socket's connectionID, randomly generated between sessions. */
  connectionID?: string;
  /** Whether a socket is logged in. */
  loggedIn?: boolean;
  /** Player rank of a socket */
  playerRank?: PlayerRank;
  /** These are used for rate limiting. */
  accumulatedMessages?: number;
  /** These are used for rate limiting. */
  rateLimiting?: {
    last: number;
    count: number;
  };
};

let sockets: Array<GameSocket> = [];
let rooms: Array<SingleplayerRoom | MultiplayerRoom> = [];

const STATUS = {
  databaseAvailable: false,
  lastDeltaTimeToUpdate: 0
};

/**
 * Removes the socket from memory.
 * @param {GameSocket} socketToClose The socket to remove.
 */
function deleteSocket(socketToClose: GameSocket) {
  // update room that socket is in
  if (typeof socketToClose.connectionID === "string") {
    const connectionID = socketToClose.connectionID;
    const room = rooms.find(
      (room) =>
        room.memberConnectionIDs.indexOf(socketToClose.connectionID as string) >
        -1
    );
    if (room) {
      room.deleteMember(socketToClose);
      // If room that socket is in is a multiplayer room, eliminate it too.
      if (room instanceof MultiplayerRoom) {
        const gameData = getGameDataFromConnectionID(connectionID);
        room.eliminateSocketID(connectionID, gameData ?? {});
      }
    }
  }
  // delete the socket
  const socketToDeleteIndex: number = sockets.indexOf(socketToClose);
  if (socketToDeleteIndex > -1) {
    sockets.splice(socketToDeleteIndex, 1);
  }
}

function forceDeleteAndCloseSocket(socketToClose: GameSocket) {
  log.warn(`Forcing deleting+closing socket ID ${socketToClose.connectionID}`);
  const socketToDeleteIndex: number = sockets.indexOf(socketToClose);
  if (socketToDeleteIndex > -1) {
    sockets.splice(socketToDeleteIndex, 1);
  }
  socketToClose?.close();
}

/**
 * Attempts to find the socket with the ID `id`.
 * @param {string} id The ID of the socket to find.
 * @returns The `GameSocket` if such ID exists, `undefined` otherwise.
 */
function getSocketFromConnectionID(id: string) {
  return sockets.find((socket) => socket.connectionID === id);
}

/**
 * Attempts to find the socket with the ID `id`.
 * @param {string} id The ID of the socket to find.
 * @returns The `GameSocket` if such ID exists, `undefined` otherwise.
 */
function getSocketsFromUserID(id: string) {
  return sockets.filter((socket) => socket.ownerUserID === id);
}

function getNameFromConnectionID(id: string): string | undefined {
  let socket = getSocketFromConnectionID(id);
  if (typeof socket === "undefined") {
    return "???";
  }
  if (socket.loggedIn) {
    return socket.ownerUsername;
  } else {
    return socket.ownerGuestName;
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
  if (room.mode !== "defaultMultiplayer") {
    return false;
  }
  return true;
}

/**
 * Synchronizes the game data of the server from the server-side to the client-side.
 * @param {GameSocket} socket The socket to sync data with.
 */
function synchronizeMetadataWithSocket(
  socket: GameSocket,
  deltaTime: number,
  systemStatus: { [key: string]: any }
) {
  // server metadata
  STATUS.lastDeltaTimeToUpdate = deltaTime;
  const metadataToSend = getServerMetadata(deltaTime, systemStatus);
  const socketID = socket?.connectionID;
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
  if (socket.connectionID) {
    const id = socket.connectionID;
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
 * @param {GameSocket} socket The socket to sync data with.
 */
function synchronizeGameDataWithSocket(socket: GameSocket) {
  const socketGameData = getGameDataFromConnectionID(
    socket.connectionID as string
  );
  const clonedSocketGameData = _.cloneDeep(socketGameData);
  if (clonedSocketGameData) {
    // remove some game data
    minifySelfGameData(clonedSocketGameData);
    // add some game data (extra information)
    // such as for multiplayer
    if (clonedSocketGameData.mode.indexOf("Multiplayer") > -1) {
      let room = findRoomWithConnectionID(socket.connectionID);
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
  const onlineRegistered = sockets.filter((e) => e.loggedIn).length;
  const onlineGuests = online - onlineRegistered;
  const roomsTotal = rooms.length;
  // TODO: Change this when custom singleplayer comes
  const roomsMulti =
    rooms.filter((e) => e.mode === "defaultMultiplayer").length || 0;
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
function sendGlobalToastNotification(settings: { [key: string]: any }) {
  const tns = settings;
  for (const socket of sockets) {
    if (socket) {
      socket.send(
        // TODO: Refactor this?
        JSON.stringify({
          message: "createToastNotification",
          text: tns.text,
          position: tns.position,
          lifespan: tns.lifespan,
          foregroundColor: tns.foregroundColor,
          backgroundColor: tns.backgroundColor,
          borderColor: tns.borderColor
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

export {
  GameSocket,
  sockets,
  deleteSocket,
  rooms,
  getSocketFromConnectionID,
  getGameDataFromConnectionID,
  getNameFromConnectionID,
  getSocketsFromUserID,
  STATUS,
  synchronizeGameDataWithSocket,
  synchronizeMetadataWithSocket,
  sendGlobalToastNotification,
  forceDeleteAndCloseSocket,
  sendGlobalWebSocketMessage,
  checkIfSocketIsPlaying
};
