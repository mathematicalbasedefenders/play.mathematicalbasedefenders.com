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
                room.data.currentGame.players[socket.id].currentGame
                    .tilesInCurrentProblem.length;
                i++
            ) {
                let t = new tile.Tile(
                    generation.generateRandomTileTermID(room, socket.id),
                    i,
                    false,
                    room.data.currentGame.players[socket.id].currentGame
                        .tilesCreated + 1
                );

                room.data.currentGame.players[socket.id].currentGame
                    .tilesCreated++;
                room.data.currentGame.players[
                    socket.id
                ].currentGame.tilesOnBoard[
                    room.data.currentGame.players[
                        socket.id
                    ].currentGame.tilesInCurrentProblem[i]
                ] = t;
            }

            room.data.currentGame.players[
                socket.id
            ].currentGame.currentProblemAsText = "";
            room.data.currentGame.players[
                socket.id
            ].currentGame.currentProblemAsBeautifulText = "";
            room.data.currentGame.players[
                socket.id
            ].currentGame.tilesInCurrentProblem = [];
            break;
        }
        case "defaultMultiplayerMode": {
            for (
                i = 0;
                i <
                room.data.currentGame.players[socket.id].currentGame
                    .tilesInCurrentProblem.length;
                i++
            ) {
                let t = new tile.Tile(
                    getMultiplayerTileQueueOfPlayer(room, socket),
                    i,
                    false,
                    room.data.currentGame.players[socket.id].currentGame
                        .tilesCreated + 1
                );
                room.data.currentGame.players[socket.id].currentGame
                    .tilesCreated++;
                room.data.currentGame.players[
                    socket.id
                ].currentGame.tilesOnBoard[
                    room.data.currentGame.players[
                        socket.id
                    ].currentGame.tilesInCurrentProblem[i]
                ] = t;
            }

            room.data.currentGame.players[
                socket.id
            ].currentGame.currentProblemAsText = "";
            room.data.currentGame.players[
                socket.id
            ].currentGame.currentProblemAsBeautifulText = "";
            room.data.currentGame.players[
                socket.id
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
        room.data.currentGame.players[socket.id].currentGame.tileQueue[
            room.data.currentGame.players[socket.id].currentGame
                .currentTileQueue
        ].length == 0
    ) {
        room.data.currentGame.players[socket.id].currentGame.currentTileQueue++;
        if (
            room.data.currentGame.globalTileQueues.length <
            room.data.currentGame.players[socket.id].currentGame
                .currentTileQueue
        ) {
            room.data.currentGame.globalTileQueue.push(
                generateMultiplayerTileQueue()
            );
            room.data.currentGame.players[socket.id].currentGame.tileQueue.push(
                room.data.currentGame.players[socket.id].currentGame
                    .currentTileQueue
            );
        }
    }

    let tile =
        room.data.currentGame.players[socket.id].currentGame.tileQueue[
            room.data.currentGame.players[socket.id].currentGame
                .currentTileQueue
        ][0];

    room.data.currentGame.players[socket.id].currentGame.tileQueue[
        room.data.currentGame.players[socket.id].currentGame.currentTileQueue
    ].shift();
    return tile;
}

function getRoomPlayers(roomData) {
    return [
        Object.keys(roomData.playersInRoom).map((player) => {
            if (roomData.playersInRoom[player].loggedIn) {
                return {
                    name: roomData.playersInRoom[player].usernameOfSocketOwner,
                    nameColor: utilities.formatPlayerName(
                        roomData.playersInRoom[player],
                        roomData.playersInRoom[player].usernameOfSocketOwner
                    )
                };
            } else {
                return {
                    name: roomData.playersInRoom[player].guestNameOfSocketOwner,
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
