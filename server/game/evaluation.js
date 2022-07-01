const mexp = require("math-expression-evaluator");

const enemies = require("./enemies.js");
const tiles = require("./tiles.js");
const rooms = require("./rooms.js");


/**
 * Checks a sent problem.
 * @param {*} room
 * @param {*} socket
 */
 function checkProblem(room, socket) {
    switch (room.type) {
        case "singleplayer": {
            evaluateProblem(room, socket);
            break;
        }
        case "defaultMultiplayerMode": {
            if (evaluateProblem(room, socket)) {
            } else {
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.sentEnemiesToSpawn +=
                    room.data.currentGame.players[
                        socket.connectionID
                    ].currentGame.enemiesPending;
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.enemiesPending = 0;
            }
            break;
        }
    }
}

/**
 * Assigns a value to a player in a Multiplayer Room.
 * @param {*} problemOnLeftSide
 * @param {*} problemOnRightSide
 * @param {*} room
 * @param {*} socket
 * @returns
 */
function assignValueToRoomPlayerVariable(
    problemOnLeftSide,
    problemOnRightSide,
    room,
    socket
) {
    if (
        problemOnLeftSide.match(/[a-d]/) != null &&
        calculateProblem(problemOnRightSide, room, socket) != null
    ) {
        switch (problemOnLeftSide) {
            case "a": {
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.valueOfVariableA = calculateProblem(
                    problemOnRightSide,
                    room,
                    socket
                );
                break;
            }
            case "b": {
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.valueOfVariableB = calculateProblem(
                    problemOnRightSide,
                    room,
                    socket
                );
                break;
            }
            case "c": {
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.valueOfVariableC = calculateProblem(
                    problemOnRightSide,
                    room,
                    socket
                );
                break;
            }
            case "d": {
                room.data.currentGame.players[
                    socket.connectionID
                ].currentGame.valueOfVariableD = calculateProblem(
                    problemOnRightSide,
                    room,
                    socket
                );
                break;
            }
        }
        rooms.replacePlayerRoomTiles(room, socket);
        return true;
    }
    return false;
}

/**
 * Evaluates the problem results.
 * @param {*} room
 * @param {*} socket
 * @returns
 */
 function evaluateProblem(room, socket) {
    switch (
        (
            room.data.currentGame.players[
                socket.connectionID
            ].currentGame.currentProblemAsText.match("=") || []
        ).length
    ) {
        case 0: {
            let originalProblem =
                room.data.currentGame.players[socket.connectionID].currentGame
                    .currentProblemAsText;
            let problemToEvaluate = fixProblem(originalProblem);
            let result = calculateProblem(problemToEvaluate, room, socket);
            let hasResults = evaluateProblemResult(result, room, socket);
            return hasResults;
        }
        case 1: {
            let originalProblem =
                room.data.currentGame.players[socket.connectionID].currentGame
                    .currentProblemAsText;
            let problemToEvaluate = fixProblem(originalProblem);
            let problemOnLeftSide = problemToEvaluate.substring(
                0,
                problemToEvaluate.indexOf("=")
            );
            let problemOnRightSide = problemToEvaluate.substring(
                problemToEvaluate.indexOf("=") + 1
            );
            let valid = assignValueToRoomPlayerVariable(
                problemOnLeftSide,
                problemOnRightSide,
                room,
                socket
            );
            return valid;
        }
        default: {
            return false;
        }
    }
}

/**
 * "Formats" the problem.
 * @param {*} problemToFix
 * @returns
 */
function fixProblem(problemToFix) {
    problemToFix = problemToFix.toString();
    while (problemToFix.match(/([0-9a-d])([a-d])/) != null) {
        problemToFix = problemToFix.replace(/([0-9a-d])([a-d])/g, "$1*$2");
    }
    return problemToFix;
}

/**
 * Calculates the problem given.
 * @param {*} problem
 * @param {*} room
 * @param {*} socket
 * @returns The result of the problem, or null if a result could not be given.
 */
 function calculateProblem(problem, room, socket) {
    try {
        return mexp.eval(
            problem,
            [
                { type: 3, token: "a", show: "a", value: "a" },
                { type: 3, token: "b", show: "b", value: "b" },
                { type: 3, token: "c", show: "c", value: "c" },
                { type: 3, token: "d", show: "d", value: "d" }
            ],
            {
                a: room.data.currentGame.players[socket.connectionID].currentGame
                    .valueOfVariableA,
                b: room.data.currentGame.players[socket.connectionID].currentGame
                    .valueOfVariableB,
                c: room.data.currentGame.players[socket.connectionID].currentGame
                    .valueOfVariableC,
                d: room.data.currentGame.players[socket.connectionID].currentGame
                    .valueOfVariableD
            }
        );
    } catch (error) {
        return null;
    }
}

/**
 * Evaluates a problem for a player in a Multiplayer room.
 * @param {*} result
 * @param {*} room
 * @param {*} socket
 * @returns
 */
 function evaluateProblemResult(result, room, socket) {
    let hasAnswers = false;
    let requestedValues = [];
    let answers = 0;
    let enemiesToKill = [];
    let originalProblem =
        room.data.currentGame.players[socket.connectionID].currentGame
            .currentProblemAsText;
    if (result) {
        // evaluate calculated string
        for (
            i = 0;
            i <
            room.data.currentGame.players[socket.connectionID].currentGame.enemiesOnField
                .length;
            i++
        ) {
            requestedValues.push(
                room.data.currentGame.players[socket.connectionID].currentGame
                    .enemiesOnField[i] === undefined &&
                    room.data.currentGame.players[socket.connectionID].currentGame
                        .enemiesOnField[i].sPosition < 0
                    ? undefined
                    : room.data.currentGame.players[socket.connectionID].currentGame
                          .enemiesOnField[i].requestedValue
            );
        }
        for (i = 0; i < requestedValues.length; i++) {
            if (
                result == calculateProblem(requestedValues[i], room, socket) ||
                (requestedValues[i] !== undefined
                    ? originalProblem.toString() ==
                      requestedValues[i].toString()
                    : false)
            ) {
                answers++;
                enemiesToKill.push(
                    room.data.currentGame.players[socket.connectionID].currentGame
                        .enemiesOnField[i]
                );
            }
        }
        if (answers > 0 && result !== undefined) {
            enemies.killPlayerRoomEnemies(enemiesToKill, room, socket);
            rooms.replacePlayerRoomTiles(room, socket);
            enemiesToKill = [];
            hasAnswers = true;
        }
        return hasAnswers;
    } else {
        // evaluate RAW result (i.e. the problem string itself)
        for (
            i = 0;
            i <
            room.data.currentGame.players[socket.connectionID].currentGame.enemiesOnField
                .length;
            i++
        ) {
            requestedValues.push(
                room.data.currentGame.players[socket.connectionID].currentGame
                    .enemiesOnField[i] === undefined &&
                    room.data.currentGame.players[socket.connectionID].currentGame
                        .enemiesOnField[i].sPosition < 0
                    ? undefined
                    : room.data.currentGame.players[socket.connectionID].currentGame
                          .enemiesOnField[i].requestedValue
            );
        }

        for (i = 0; i < requestedValues.length; i++) {
            if (
                result == calculateProblem(requestedValues[i], room, socket) ||
                (requestedValues[i] !== undefined
                    ? originalProblem.toString() ==
                      requestedValues[i].toString()
                    : false)
            ) {
                answers++;
                enemiesToKill.push(
                    room.data.currentGame.players[socket.connectionID].currentGame
                        .enemiesOnField[i]
                );
            }
        }
        if (answers > 0 && result !== undefined) {
            enemies.killPlayerRoomEnemies(enemiesToKill, room, socket);
            rooms.replacePlayerRoomTiles(room, socket);
            enemiesToKill = [];
            hasAnswers = true;
        }
        return hasAnswers;
    }
}

module.exports = {
    checkProblem,assignValueToRoomPlayerVariable,evaluateProblem,fixProblem,calculateProblem,evaluateProblemResult
}
