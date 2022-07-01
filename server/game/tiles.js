const terms = require("./terms.js")
const evaluation = require("./evaluation.js");
const input = require("./input.js");



function convertPressedKeyToTermID(keyPressed, playerKeybinds, room, socket) {
    if (keyPressed == "Space") {
        // space
        evaluation.checkProblem(room, socket);
        return;
    } else if (keyPressed == "Period" || keyPressed == "Backspace") {
        //numpad decimal
        terms.deleteLastSelectedTerm(room, socket);
        return;
    } else if (keyPressed == "NumpadEnter") {
        //numpad enter
        return 14;
    } else {
        if (keyPressed.includes("Num") && keyPressed != "NumLock") {
            // unsafe?
            return [
                "Numpad0",
                "Numpad1",
                "Numpad2",
                "Numpad3",
                "Numpad4",
                "Numpad5",
                "Numpad6",
                "Numpad7",
                "Numpad8",
                "Numpad9",
                "NumpadAdd",
                "NumpadSubtract",
                "NumpadMultiply",
                "NumpadDivide",
                "NumpadEnter"
            ].indexOf(keyPressed);
        } else {
            return playerKeybinds.indexOf(keyPressed);
        }
    }
}

function forceSelectTileWithTermID(termIDToSelect, room, socket) {
    for (i = 0; i < 49; i++) {
        if (
            room.data.currentGame.players[socket.connectionID].currentGame.tilesOnBoard[i]
                .termID == termIDToSelect &&
            room.data.currentGame.players[socket.connectionID].currentGame.tilesOnBoard[i]
                .selected == false
        ) {
            input.processTileClick(i, room, socket);
            return; // break
        }
    }
}



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
                    generateRandomTileTermID(room, socket.connectionID),
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



function generateMultiplayerTileQueue() {
    let bagQuantities = [
        4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2
    ];
    let availableTermsIndexes = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
    ];
    let queue = [];

    for (let i = 0; i < 49; i++) {
        let roll =
            availableTermsIndexes[
                Math.floor(Math.random() * availableTermsIndexes.length)
            ];

        queue.push(roll);
        bagQuantities[roll]--;
        if (bagQuantities[roll] <= 0) {
            availableTermsIndexes.splice(
                availableTermsIndexes.indexOf(roll),
                1
            );
            if (availableTermsIndexes.length <= 0) {
                bagQuantities = [
                    4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2
                ];
                availableTermsIndexes = [
                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
                    17, 18
                ];
            }
        }
    }

    return queue;
}


module.exports = {
    convertPressedKeyToTermID,
    forceSelectTileWithTermID,generateMultiplayerTileQueue,
    replacePlayerRoomTiles
}