type GameSocket = object & {
  owner?: string;
  ownerID?: string;
  ownerGuestName?: string;
  connectionID?: string;
};

let sockets: Array<GameSocket> = [];

function deleteSocket(socketToClose: GameSocket) {
  let socketToDeleteIndex: number = sockets.indexOf(socketToClose);
  sockets.splice(socketToDeleteIndex, 1);
}

export { GameSocket, sockets, deleteSocket };
