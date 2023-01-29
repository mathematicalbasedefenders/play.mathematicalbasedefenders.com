import { WebSocket } from "uWebSockets.js";
import { Room } from "./core/Room";

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

export { GameSocket, sockets, deleteSocket, rooms, getSocketFromConnectionID };
