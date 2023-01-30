import { WebSocket } from "uWebSockets.js";
import { SingleplayerGameData, Room } from "./core/Room";

type GameSocket = WebSocket & {
  owner?: string;
  ownerID?: string;
  ownerGuestName?: string;
  connectionID?: string;
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

function getGameDataFromConnectionID(
  id: string
): SingleplayerGameData | undefined {
  for (let room of rooms) {
    for (let data of room.gameData) {
      if (data.owner === id) {
        return data;
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
  getGameDataFromConnectionID
};
