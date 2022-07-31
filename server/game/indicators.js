const utilities = require("./utilities.js");
const global = require("../global.js");

function addIndicatorToSingleplayerRoom(
    room,
    socketID,
    problemLength,
    currentCombo,
    enemySPosition
) {
    room.data.currentGame.players[
        socketID
    ].currentGame.scoreGainIndicators.push({
        number:
            room.data.currentGame.players[socketID].currentGame.enemiesKilled +
            1,
        sPosition: enemySPosition,
        content:
            "+" +
            Math.round(
                100 *
                    utilities.calculateProblemLengthMultiplier(problemLength) *
                    utilities.calculateComboMultiplier(currentCombo) *
                    utilities.calculateEnemyPositionMultiplier(enemySPosition)
            ).toString(),
        ageInMilliseconds: 0
    });
}

function addIndicatorToMultiplayerRoom(
    room,
    socketID,
    enemiesSent,
    enemySPosition
) {
    room.data.currentGame.players[
        socketID
    ].currentGame.enemiesSentIndicators.push({
        number:
            room.data.currentGame.players[socketID].currentGame.enemiesKilled +
            1,
        sPosition: enemySPosition,
        content: enemiesSent.toString(),
        ageInMilliseconds: 0
    });
}

module.exports = {
    addIndicatorToSingleplayerRoom,
    addIndicatorToMultiplayerRoom
};
