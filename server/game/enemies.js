const utilities = require("./utilities.js");
const _ = require("lodash");

const scoring = require("./scoring.js");
const indicators = require("./indicators.js");


/**
 * Kills enemies for a player in a Multiplayer room.
 * @param {*} enemiesToKill
 * @param {*} room
 * @param {*} socket
 */
function killPlayerRoomEnemies(enemiesToKill, room, socket) {
    let indicatorName;
    let statToAddTo;

    switch (room.gameMode) {
        case "easySingleplayerMode":
        case "standardSingleplayerMode":
        case "customSingleplayerMode": {
            indicatorName = "scoreGainIndicators";
            statToAddTo = "currentScore";
            killSingleplayerRoomEnemies(
                enemiesToKill,
                room,
                socket,
                indicatorName,
                statToAddTo
            );
            break;
        }
        case "defaultMultiplayerMode": {
            indicatorName = "enemiesSentIndicators";
            statToAddTo = "enemiesSent";
            killMultiplayerRoomEnemies(
                enemiesToKill,
                room,
                socket,
                indicatorName,
                statToAddTo
            );
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

function generateRandomEnemyTerm() {
    let roll = Math.random();
    if (roll < 0.9) {
        return (
            (Math.random() >= 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000)
        );
    } else if (roll < 0.925) {
        return (
            (Math.random() >= 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000) +
            "a"
        );
    } else if (roll < 0.95) {
        return (
            (Math.random() >= 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000) +
            "b"
        );
    } else if (roll < 0.975) {
        return (
            (Math.random() >= 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000) +
            "c"
        );
    } else {
        return (
            (Math.random() >= 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000) +
            "d"
        );
    }
}

// ======

function killSingleplayerRoomEnemies(
    enemiesToKill,
    room,
    socket,
    indicatorName,
    statToAddTo
) {
    for (i = 0; i < enemiesToKill.length; i++) {
        resetEnemyKillTimerForSocketID(room, socket.id);

        room.data.currentGame.players[socket.id].currentGame.currentCombo++;

        let problemLength =
            room.data.currentGame.players[socket.id].currentGame
                .currentProblemAsText.length;
        let currentCombo =
            room.data.currentGame.players[socket.id].currentGame.currentCombo;
        let enemySPosition = enemiesToKill[i].sPosition;

        scoring.addScoreToPlayerInSingleplayerRoom(
            room,
            socket.id,
            problemLength,
            currentCombo,
            enemySPosition
        );

        indicators.addIndicatorToSingleplayerRoom(
            room,
            socket.id,
            problemLength,
            currentCombo,
            enemySPosition
        );

        room.data.currentGame.players[socket.id].currentGame.enemiesOnField[
            room.data.currentGame.players[
                socket.id
            ].currentGame.enemiesOnField.indexOf(enemiesToKill[i])
        ].toDestroy = true;

        room.data.currentGame.players[socket.id].currentGame.enemiesKilled++;
    }
}

function killMultiplayerRoomEnemies(
    enemiesToKill,
    room,
    socket,
    indicatorName,
    statToAddTo
) {
    for (i = 0; i < enemiesToKill.length; i++) {
        // Reset counter
        resetEnemyKillTimerForSocketID(room, socket.id);

        room.data.currentGame.players[socket.id].currentGame.currentCombo++;

        let problemLength =
            room.data.currentGame.players[socket.id].currentGame
                .currentProblemAsText.length;

        let currentCombo =
            room.data.currentGame.players[socket.id].currentGame.currentCombo;

        let enemySPosition = enemiesToKill[i].sPosition;

        let enemiesSent = calculateNumberOfEnemiesSent(
            problemLength,
            currentCombo,
            enemySPosition
        );

        indicators.addIndicatorToMultiplayerRoom(
            room,
            socket.id,
            enemiesSent,
            enemySPosition
        );

        room.data.currentGame.players[socket.id].currentGame.enemiesSent +=
            enemiesSent;

        let playerToSendEnemiesTo = _.sample(room.data.currentGame.players);
        while (playerToSendEnemiesTo.currentGame.connectionID == socket.id) {
            playerToSendEnemiesTo = _.sample(room.data.currentGame.players);
        }

        sendEnemiesToPlayer(room, socket.id, playerToSendEnemiesTo.currentGame.connectionID, enemiesSent);

        room.data.currentGame.players[socket.id].currentGame.enemiesOnField[
            room.data.currentGame.players[
                socket.id
            ].currentGame.enemiesOnField.indexOf(enemiesToKill[i])
        ].toDestroy = true;

        room.data.currentGame.players[socket.id].currentGame.enemiesKilled++;
    }
}

function resetEnemyKillTimerForSocketID(room, socketID) {
    room.data.currentGame.players[
        socketID
    ].currentGame.framesElapsedSinceLastEnemyKill = 0;
    room.data.currentGame.players[
        socketID
    ].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds = 0;
}

function calculateNumberOfEnemiesSent(
    problemLength,
    currentCombo,
    enemySPosition
) {
    return Math.max(
        0,
        Math.floor(
            ((problemLength - 3) / 1.05 +
                (currentCombo - 2) +
                (enemySPosition - 5) / 1.25 +
                2) /
                1.25
        )
    );
}

function sendEnemiesToPlayer(
    room,
    senderSocketID,
    targetSocketID,
    enemiesSent
) {
    while (enemiesSent > 0) {
        if (
            room.data.currentGame.players[senderSocketID].currentGame
                .enemiesPending <= 0
        ) {
            room.data.currentGame.players[
                targetSocketID
            ].currentGame.enemiesPending += 1;
            room.data.currentGame.players[
                targetSocketID
            ].currentGame.enemySenders.push(
                room.data.currentGame.players[senderSocketID].currentGame
                    .playerName
            );
        } else {
            room.data.currentGame.players[
                senderSocketID
            ].currentGame.enemiesPending -= 1;
        }
        enemiesSent--;
    }
}

module.exports = {
    killPlayerRoomEnemies,
    generateRandomEnemyTerm
};
