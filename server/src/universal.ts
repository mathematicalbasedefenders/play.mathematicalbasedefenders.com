import { WebSocket } from "uWebSockets.js";
import {
  SingleplayerRoom,
  MultiplayerRoom,
  getOpponentsInformation,
  Room
} from "./game/rooms/Room";
import { GameData, SingleplayerGameData } from "./game/GameData";
import _ from "lodash";
import { minifySelfGameData, findRoomWithConnectionID } from "./core/utilities";

type GameSocket = WebSocket & {
  ownerUsername?: string;
  ownerUserID?: string;
  ownerGuestName?: string;
  connectionID?: string;
  loggedIn?: boolean;
};

let sockets: Array<GameSocket> = [];
let rooms: Array<SingleplayerRoom | MultiplayerRoom> = [];

const STATUS = {
  databaseAvailable: false
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
  sockets.splice(socketToDeleteIndex, 1);
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
 * Synchronizes the game data of the server from the server-side to the client-side.
 * @param {GameSocket} socket The socket to sync data with.
 */
function synchronizeMetadataWithSocket(socket: GameSocket, deltaTime: number) {
  const metadataToSend = getServerMetadata(deltaTime);
  socket.send(
    JSON.stringify({
      message: "updateServerMetadata",
      data: metadataToSend
    })
  );
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
function getServerMetadata(deltaTime: number) {
  const online = sockets.length;
  const onlineRegistered = sockets.filter((e) => e.loggedIn).length;
  const onlineGuests = online - onlineRegistered;
  const roomsTotal = rooms.length;
  // TODO: Change this when custom singleplayer comes
  const roomsMulti =
    rooms.filter((e) => e.mode === "defaultMultiplayer").length || 0;
  const roomsSingle = roomsTotal - roomsMulti;
  return {
    onlineTotal: online,
    onlineRegistered: onlineRegistered,
    onlineGuests: onlineGuests,
    roomsTotal: roomsTotal,
    roomsMulti: roomsMulti,
    roomsSingle: roomsSingle,
    lastUpdated: deltaTime
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
  sendGlobalToastNotification
};
