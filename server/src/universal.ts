import { WebSocket } from "uWebSockets.js";
import {
  SingleplayerGameData,
  Room,
  SingleplayerRoom,
  MultiplayerRoom,
  getOpponentInformation
} from "./game/Room";
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
    const roomThatSocketWasIn: any = rooms.find(
      (room) =>
        room.memberConnectionIDs.indexOf(socketToClose.connectionID as string) >
        -1
    );
    roomThatSocketWasIn?.deleteMember(socketToClose.connectionID);
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

function getGameDataFromConnectionID(id: string): SingleplayerGameData | null {
  for (let room of rooms) {
    if (room) {
      for (let data of room.gameData) {
        if (data.owner === id) {
          return data;
        }
      }
    }
  }
  return null;
}

function synchronizeDataWithSocket(socket: GameSocket) {
  let gameDataOfOwner = _.cloneDeep(
    getGameDataFromConnectionID(socket.connectionID as string)
  );
  if (gameDataOfOwner) {
    // remove some game data
    minifySelfGameData(gameDataOfOwner);
    // add some game data (extra information)
    // such as for multiplayer
    if (gameDataOfOwner.mode.indexOf("Multiplayer") > -1) {
      let room = findRoomWithConnectionID(socket.connectionID);
      if (room) {
        gameDataOfOwner.opponentGameData = getOpponentInformation(
          gameDataOfOwner,
          room,
          true
        );
      }
    }
    let gameDataToSend: string = JSON.stringify(gameDataOfOwner);
    getSocketFromConnectionID(socket.connectionID as string)?.send(
      JSON.stringify({
        message: "renderGameData",
        data: gameDataToSend
      })
    );
    // other commands
    for (let commandType in gameDataOfOwner.commands) {
      // TODO: imperfect
      for (let command in gameDataOfOwner.commands[commandType]) {
        if (
          typeof gameDataOfOwner.commands[commandType][command].age ===
          "undefined"
        ) {
          gameDataOfOwner.commands[commandType][command].age = 0;
        } else {
          gameDataOfOwner.commands[commandType][command].age += 1;
          if (gameDataOfOwner.commands[commandType][command].age >= 3) {
            delete gameDataOfOwner.commands[commandType][command];
          }
        }
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
  synchronizeDataWithSocket
};
