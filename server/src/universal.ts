import { WebSocket } from "uWebSockets.js";
import {
  SingleplayerGameData,
  Room,
  SingleplayerRoom,
  MultiplayerRoom
} from "./game/Room";

type GameSocket = WebSocket & {
  ownerUsername?: string;
  ownerUserID?: string;
  ownerGuestName?: string;
  connectionID?: string;
  loggedIn?: boolean;
};

let sockets: Array<GameSocket> = [];
let rooms: Array<SingleplayerRoom | MultiplayerRoom> = [];

function deleteSocket(socketToClose: GameSocket) {
  // update room that socket is in
  if (typeof socketToClose.connectionID === "string") {
    let roomThatSocketWasIn: any = rooms.find(
      (room) =>
        room.memberConnectionIDs.indexOf(socketToClose.connectionID as string) >
        -1
    );
    roomThatSocketWasIn?.deleteMember(socketToClose.connectionID);
  }
  // delete the socket
  let socketToDeleteIndex: number = sockets.indexOf(socketToClose);
  sockets.splice(socketToDeleteIndex, 1);
}

function getSocketFromConnectionID(id: string): GameSocket | undefined {
  return sockets.find((socket) => socket.connectionID === id);
}

function getSocketsFromUserID(id: string): Array<GameSocket> | undefined {
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

export {
  GameSocket,
  sockets,
  deleteSocket,
  rooms,
  getSocketFromConnectionID,
  getGameDataFromConnectionID,
  getNameFromConnectionID,
  getSocketsFromUserID
};
