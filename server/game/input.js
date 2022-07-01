const utilities = require("./utilities.js");

function processTileClick(slot, room, socket) {
    if (socket.variables.currentRoomSocketIsIn != "") {
        room.data.currentGame.players[socket.connectionID].currentGame.actionsPerformed++;
        room.data.currentGame.players[socket.connectionID].currentGame.tilesOnBoard[
            slot
        ].selected =
            !room.data.currentGame.players[socket.connectionID].currentGame.tilesOnBoard[
                slot
            ].selected;
        if (
            room.data.currentGame.players[socket.connectionID].currentGame.tilesOnBoard[
                slot
            ].selected
        ) {
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.tilesInCurrentProblem.push(slot);
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.currentProblemAsText += utilities.convertTermIDToTerm(
                room.data.currentGame.players[socket.connectionID].currentGame
                    .tilesOnBoard[slot].termID
            );
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.currentProblemAsBeautifulText += utilities.convertTermIDToBeautifulString(
                room.data.currentGame.players[socket.connectionID].currentGame
                    .tilesOnBoard[slot].termID
            );
        } else {
            let index =
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.tilesInCurrentProblem.indexOf(slot);
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.tilesInCurrentProblem.splice(index, 1);
            let temp =
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.currentProblemAsText.split("");
            temp.splice(index, 1);
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.currentProblemAsText = temp.join("");
            let temp2 =
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.currentProblemAsBeautifulText.split("");
            temp2.splice(index, 1);
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.currentProblemAsBeautifulText = temp2.join("");
        }
    }
}

module.exports = {
    processTileClick,
}