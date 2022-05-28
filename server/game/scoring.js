const utilities = require("./utilities.js");

function addScoreToPlayerInSingleplayerRoom(room, socketID, problemLength, currentCombo, enemySPosition){
    room.data.currentGame.players[socketID].currentGame.currentScore +=
            Math.round(
                100 *
                    utilities.calculateProblemLengthMultiplier(
                        problemLength
                    ) *
                    utilities.calculateComboMultiplier(
                        currentCombo
                    ) *
                    utilities.calculateEnemyPositionMultiplier(
                        enemySPosition
                    )
            );

}

module.exports = {
    addScoreToPlayerInSingleplayerRoom
}