import { WebSocket } from "uWebSockets.js";
import { SingleplayerGameData, Room } from "./game/Room";

type GameSocket = WebSocket & {
  ownerUsername?: string;
  ownerUserID?: string;
  ownerGuestName?: string;
  connectionID?: string;
  loggedIn?: boolean;
};

let sockets: Array<GameSocket> = [];
let rooms: Array<Room> = [];

function deleteSocket(socketToClose: GameSocket) {
  let socketToDeleteIndex: number = sockets.indexOf(socketToClose);
  sockets.splice(socketToDeleteIndex, 1);
}

function getSocketFromConnectionID(id: string): GameSocket | undefined {
  return sockets.find((socket) => socket.connectionID === id);
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
  getGameDataFromConnectionID
};
