const tiles = require("./tiles.js");
const tile = require("./constructors/tile.js");
const utilities = require("./utilities.js");
const generation = require("./generation.js");

/**
 * Replaces tiles for a player in a Multiplayer Room.
 * @param {*} room
 * @param {*} socket
 */
function replacePlayerRoomTiles(room, socket) {
    switch (room.gameMode) {
        case "easySingleplayerMode":
        case "standardSingleplayerMode":
        case "customSingleplayerMode": {
            for (
                i = 0;
                i <
                room.data.currentGame.players[socket.connectionID].currentGame
                    .tilesInCurrentProblem.length;
                i++
            ) {
                let t = new tile.Tile(
                    generation.generateRandomTileTermID(room, socket.connectionID),
                    i,
                    false,
                    room.data.currentGame.players[socket.connectionID].currentGame
                        .tilesCreated + 1
                );

                room.data.currentGame.players[socket.connectionID].currentGame
                    .tilesCreated++;
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.tilesOnBoard[
                    room.data.currentGame.players[
                        socket.connectionID
                    ].currentGame.tilesInCurrentProblem[i]
                ] = t;
            }

            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.currentProblemAsText = "";
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.currentProblemAsBeautifulText = "";
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.tilesInCurrentProblem = [];
            break;
        }
        case "defaultMultiplayerMode": {
            for (
                i = 0;
                i <
                room.data.currentGame.players[socket.connectionID].currentGame
                    .tilesInCurrentProblem.length;
                i++
            ) {
                let t = new tile.Tile(
                    getMultiplayerTileQueueOfPlayer(room, socket),
                    room.data.currentGame.players[
                        socket.connectionID
                    ].currentGame.tilesOnBoard[
                        room.data.currentGame.players[
                            socket.connectionID
                        ].currentGame.tilesInCurrentProblem[i]
                    ].slot,
                    false,
                    room.data.currentGame.players[socket.connectionID].currentGame
                        .tilesCreated + 1
                );
                room.data.currentGame.players[socket.connectionID].currentGame
                    .tilesCreated++;
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.tilesOnBoard[
                    room.data.currentGame.players[
                        socket.connectionID
                    ].currentGame.tilesInCurrentProblem[i]
                ] = t;
                
            }

            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.currentProblemAsText = "";
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.currentProblemAsBeautifulText = "";
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.tilesInCurrentProblem = [];
            break;
        }
        default: {
            console.error(
                log.addMetadata(
                    `${room.gameMode} is not a valid game mode!`,
                    "error"
                )
            );
        }
    }
}

function getMultiplayerTileQueueOfPlayer(room, socket) {
    if (
        room.data.currentGame.players[socket.connectionID].currentGame.tileQueue[
            room.data.currentGame.players[socket.connectionID].currentGame
                .currentTileQueue
        ].length == 0
    ) {
        room.data.currentGame.players[socket.connectionID].currentGame.currentTileQueue++;
        if (
            room.data.currentGame.globalTileQueues.length <
            room.data.currentGame.players[socket.connectionID].currentGame
                .currentTileQueue
        ) {
            room.data.currentGame.globalTileQueue.push(
                generateMultiplayerTileQueue()
            );
            room.data.currentGame.players[socket.connectionID].currentGame.tileQueue.push(
                room.data.currentGame.players[socket.connectionID].currentGame
                    .currentTileQueue
            );
        }
    }

    let tile =
        room.data.currentGame.players[socket.connectionID].currentGame.tileQueue[
            room.data.currentGame.players[socket.connectionID].currentGame
                .currentTileQueue
        ][0];

    room.data.currentGame.players[socket.connectionID].currentGame.tileQueue[
        room.data.currentGame.players[socket.connectionID].currentGame.currentTileQueue
    ].shift();

    return tile;
}

function getRoomPlayers(roomData) {
    return [
        Object.keys(roomData.playersInRoom).map((player) => {
            if (roomData.playersInRoom[player].variables.loggedIn) {
                return {
                    name: roomData.playersInRoom[player].variables.usernameOfSocketOwner,
                    nameColor: utilities.formatPlayerName(
                        roomData.playersInRoom[player],
                        roomData.playersInRoom[player].variables.usernameOfSocketOwner
                    )
                };
            } else {
                return {
                    name: roomData.playersInRoom[player].variables.guestNameOfSocketOwner,
                    nameColor: "#000000"
                };
            }
        })
    ];
}

module.exports = {
    getRoomPlayers,
    replacePlayerRoomTiles,
    getMultiplayerTileQueueOfPlayer
};
