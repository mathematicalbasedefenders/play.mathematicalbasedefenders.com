const input = require("./input.js");

function deleteLastSelectedTerm(room, socket) {
  if (
    room.data.currentGame.players[socket.connectionID].currentGame
      .tilesInCurrentProblem.length > 0
  ) {
    input.processTileClick(
      room.data.currentGame.players[socket.connectionID].currentGame
        .tilesInCurrentProblem[
        room.data.currentGame.players[socket.connectionID].currentGame
          .tilesInCurrentProblem.length - 1
      ],
      room,
      socket
    );
  }
}

module.exports = {
  deleteLastSelectedTerm
};
