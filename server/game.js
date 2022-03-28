const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const log = require("./core/log.js");

const _ = require("lodash");

const enemy = require("./game/enemy.js");
const tile = require("./game/tile.js");
const leveling = require("./game/leveling.js");

const mexp = require("math-expression-evaluator");

const TERMS = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "+",
    "-",
    "*",
    "/",
    "=",
    "a",
    "b",
    "c",
    "d",
    "n",
    "x",
    "y",
    "z"
];
const TERMS_AS_BEAUTIFUL_STRINGS = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "+",
    "\u2013",
    "×",
    "÷",
    "=",
    "a",
    "b",
    "c",
    "d",
    "n",
    "x",
    "y",
    "z"
];

const FRAMES_PER_SECOND = 60;

const defaults = require("./core/defaults.js");

const schemas = require("./core/schemas.js");

const webhook = require("./webhook.js");

const roomTypes = {
    SINGLEPLAYER: "singleplayer",
    EASY_SINGLEPLAYER: "easySingleplayerMode",
    STANDARD_SINGLEPLAYER: "standardSingleplayerMode",
    DEFAULT_MULTIPLAYER: "defaultMultiplayerMode",
    MULTIPLAYER: "multiplayer"
};

const modes = {
    SINGLEPLAYER: "singleplayer",
    EASY_SINGLEPLAYER: "easySingleplayerMode",
    STANDARD_SINGLEPLAYER: "standardSingleplayerMode",
    CUSTOM_SINGLEPLAYER: "customSingleplayerMode",
    DEFAULT_MULTIPLAYER: "defaultMultiplayerMode",
    MULTIPLAYER: "multiplayer"
};

const gameModes = {
    SINGLEPLAYER: "singleplayerMode",
    EASY_SINGLEPLAYER: "easySingleplayerMode",
    STANDARD_SINGLEPLAYER: "standardSingleplayerMode",
    CUSTOM_SINGLEPLAYER: "customSingleplayerMode",
    DEFAULT_MULTIPLAYER: "defaultMultiplayerMode",
    MULTIPLAYER: "multiplayerMode"
};

const GAME_SETTINGS = {
    easySingleplayerMode: {
        allowedComboTimeInMilliseconds: 10000,
        enemyGenerationThreshold: 0.975,
        enemyGenerationIntervalInMilliseconds: 50,
        enemySpeedMultiplier: 0.5,
        enemyLimit: 5
    },
    standardSingleplayerMode: {
        allowedComboTimeInMilliseconds: 5000,
        enemyGenerationThreshold: 0.95,
        enemyGenerationIntervalInMilliseconds: 50,
        enemySpeedMultiplier: 1,
        enemyLimit: 250
    },
    // TODO: will it break?
    customSingleplayerMode: {},
    defaultMultiplayerMode: {
        allowedComboTimeInMilliseconds: 5000,
        enemyGenerationThreshold: 0.95,
        enemyGenerationIntervalInMilliseconds: 50,
        enemySpeedMultiplier: 1,
        enemyLimit: 250
    }
};

/**
 * Computes an update.
 * @param {Object} room
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdate(room, deltaTimeInMilliseconds) {
    computeGlobalUpdateForRoom(room, deltaTimeInMilliseconds);
    computeUpdateForRoom(room, deltaTimeInMilliseconds);
}

async function computeGlobalUpdateForRoom(room, deltaTimeInMilliseconds) {
    // multiplayer room
    room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds +=
        deltaTimeInMilliseconds;
    if (room.gameMode == gameModes.DEFAULT_MULTIPLAYER) {
        if (
            room.data.currentGame
                .enemyGenerationElapsedTimeCounterInMilliseconds >
            GAME_SETTINGS[room.gameMode].enemyGenerationIntervalInMilliseconds
        ) {
            if (Math.random() > 0.95) {
                room.data.currentGame.globalEnemyToAdd = new enemy.Enemy({
                    xPosition: 1360,
                    yPosition: 120,
                    width: 100,
                    height: 100,
                    requestedValue: generateRandomEnemyTerm(),
                    defaultSpeed: Math.random() * 2 + 1,
                    defaultAttack: 1,
                    defaultHealth: 1,
                    enemyNumber: room.data.currentGame.globalEnemiesCreated + 1
                });
                room.data.currentGame.globalEnemiesCreated++;
            }
            room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds -=
                GAME_SETTINGS[
                    room.gameMode
                ].enemyGenerationIntervalInMilliseconds;
        } else {
            room.data.currentGame.globalEnemyToAdd = null;
        }
    }
}

async function computeUpdateForRoom(room, deltaTimeInMilliseconds) {
    let framesRendered = (deltaTimeInMilliseconds * FRAMES_PER_SECOND) / 1000;
    // counters
    // general stats
    room.data.currentGame.currentInGameTimeInMilliseconds +=
        deltaTimeInMilliseconds;
    room.data.currentGame.framesRenderedSinceGameStart += framesRendered;
    let playersAliveThisUpdate = room.data.currentGame.playersAlive;
    for (let i = 0; i < playersAliveThisUpdate.length; i++) {
        let player = playersAliveThisUpdate[i];

        // player specific stats
        room.data.currentGame.players[
            player
        ].currentGame.currentInGameTimeInMilliseconds += deltaTimeInMilliseconds;
        room.data.currentGame.players[
            player
        ].currentGame.enemyGenerationElapsedTimeCounterInMilliseconds += deltaTimeInMilliseconds;
        room.data.currentGame.players[
            player
        ].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds += deltaTimeInMilliseconds;
        room.data.currentGame.players[
            player
        ].currentGame.framesRenderedSinceGameStart += framesRendered;

        computeUpdateForRoomPlayerBaseHealth(
            room,
            player,
            deltaTimeInMilliseconds
        );
        computeUpdateForRoomPlayerCombo(room, player, deltaTimeInMilliseconds);
        computeUpdateForRoomPlayerEnemies(
            room,
            player,
            deltaTimeInMilliseconds
        );
        computeUpdateForRoomPlayerIndicators(
            room,
            player,
            deltaTimeInMilliseconds
        );
        computeUpdateForRoomPlayerThingsToRemove(
            room,
            player,
            deltaTimeInMilliseconds
        );
    }
}

async function computeUpdateForRoomPlayerBaseHealth(
    room,
    player,
    deltaTimeInMilliseconds
) {
    switch (room.gameMode) {
        case "easySingleplayerMode":
        case "standardSingleplayerMode":
        case "customSingleplayerMode":
            if (
                room.data.currentGame.players[player].currentGame.baseHealth <=
                0
            ) {
                room.data.currentGame.players[player].currentGame.dead = true;
                room.playing = false;
                room.data.currentGame.gameIsOver = true;
                room.data.currentGame.players[
                    player
                ].currentGame.gameIsOver = true;
                let socketOfGamePlayed = room.host;
                let finalGameData = JSON.parse(JSON.stringify(room.data));
                socketOfGamePlayed.emit(
                    "currentGameData",
                    JSON.stringify(finalGameData.currentGame.players[player])
                );
                socketOfGamePlayed
                    .to(room.id)
                    .emit(
                        "currentGameData",
                        JSON.stringify(
                            finalGameData.currentGame.players[player]
                        )
                    );
                room.host.leave(room.id);
                socketOfGamePlayed.currentRoomSocketIsIn = "";
                submitDefaultSingleplayerGame(
                    room.host,
                    finalGameData.currentGame.players[player].currentGame,
                    room.userIDOfHost,
                    room.data.gameMode
                );
                room.data.currentGame.players[
                    player
                ].currentGame.gameOverScreenShown = true;
            }
            break;
        case "defaultMultiplayerMode": {
            if (
                room.data.currentGame.players[player].currentGame.baseHealth <=
                0
            ) {
                room.data.currentGame.players[player].currentGame.dead = true;
            }
            break;
        }
    }
}

async function computeUpdateForRoomPlayerCombo(
    room,
    player,
    deltaTimeInMilliseconds
) {
    room.data.currentGame.players[
        player
    ].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds += deltaTimeInMilliseconds;

    if (
        room.data.currentGame.players[player].currentGame.currentCombo > -1 &&
        room.data.currentGame.players[player].currentGame
            .timeElapsedSinceLastEnemyKillInMilliseconds >
            (room.gameMode == "customSingleplayerMode"
                ? getCustomSingleplayerRoomInstance(room, player)
                : GAME_SETTINGS[room.gameMode]
            ).allowedComboTimeInMilliseconds
    ) {
        room.data.currentGame.players[player].currentGame.currentCombo = -1;
    }
}

async function computeUpdateForRoomPlayerEnemies(
    room,
    player,
    deltaTimeInMilliseconds
) {
    let framesRendered = (deltaTimeInMilliseconds * FRAMES_PER_SECOND) / 1000;

    switch (room.gameMode) {
        case "easySingleplayerMode":
        case "standardSingleplayerMode":
        case "customSingleplayerMode": {
            if (
                room.data.currentGame.players[player].currentGame
                    .enemyGenerationElapsedTimeCounterInMilliseconds >
                (room.gameMode == "customSingleplayerMode"
                    ? getCustomSingleplayerRoomInstance(room, player)
                    : GAME_SETTINGS[room.gameMode]
                ).enemyGenerationIntervalInMilliseconds
            ) {
                if (
                    Math.random() >
                        (room.gameMode == "customSingleplayerMode"
                            ? getCustomSingleplayerRoomInstance(room, player)
                            : GAME_SETTINGS[room.gameMode]
                        ).enemyGenerationThreshold &&
                    room.data.currentGame.players[player].currentGame
                        .enemiesOnField.length <
                        (room.gameMode == "customSingleplayerMode"
                            ? getCustomSingleplayerRoomInstance(room, player)
                            : GAME_SETTINGS[room.gameMode]
                        ).enemyLimit
                ) {
                    room.data.currentGame.players[
                        player
                    ].currentGame.enemiesOnField[
                        room.data.currentGame.players[
                            player
                        ].currentGame.enemiesCreated
                    ] = new enemy.Enemy({
                        xPosition: 1360,
                        yPosition: 120,
                        width: 100,
                        height: 100,
                        requestedValue: generateRandomEnemyTerm(),
                        defaultSpeed:
                            (room.gameMode == "customSingleplayerMode"
                                ? getCustomSingleplayerRoomInstance(
                                      room,
                                      player
                                  )
                                : GAME_SETTINGS[room.gameMode]
                            ).enemySpeedMultiplier *
                            (Math.random() * 2 + 1),
                        defaultAttack: 1,
                        defaultHealth: 1,
                        enemyNumber:
                            room.data.currentGame.players[player].currentGame
                                .enemiesCreated + 1
                    });
                    room.data.currentGame.players[player].currentGame
                        .enemiesCreated++;
                }
                room.data.currentGame.players[
                    player
                ].currentGame.enemyGenerationElapsedTimeCounterInMilliseconds -=
                    (
                        room.gameMode == "customSingleplayerMode"
                            ? getCustomSingleplayerRoomInstance(room, player)
                            : GAME_SETTINGS[room.gameMode]
                    ).enemyGenerationIntervalInMilliseconds;
            }
            break;
        }
        case "defaultMultiplayerMode": {
            if (room.data.currentGame.globalEnemyToAdd) {
                room.data.currentGame.players[
                    player
                ].currentGame.enemiesOnField[
                    room.data.currentGame.players[
                        player
                    ].currentGame.enemiesCreated
                ] = _.cloneDeep(room.data.currentGame.globalEnemyToAdd);
                room.data.currentGame.players[player].currentGame
                    .enemiesCreated++;
            }
            if (
                room.data.currentGame.players[player].currentGame
                    .sentEnemiesToSpawn > 0 &&
                room.data.currentGame.players[player].currentGame.enemiesOnField
                    .length <
                    (room.gameMode == "customSingleplayerMode"
                        ? getCustomSingleplayerRoomInstance(room, player)
                        : GAME_SETTINGS[room.gameMode]
                    ).enemyLimit
            ) {
                let nameToPutOnEnemy =
                    room.data.currentGame.players[player].currentGame
                        .enemySenders[0];
                room.data.currentGame.players[
                    player
                ].currentGame.enemySenders.splice(0, 1);
                room.data.currentGame.players[
                    player
                ].currentGame.enemiesOnField[
                    room.data.currentGame.players[
                        player
                    ].currentGame.enemiesCreated
                ] = new enemy.Enemy({
                    xPosition: 1360,
                    yPosition: 120,
                    width: 100,
                    height: 100,
                    requestedValue: generateRandomEnemyTerm(),
                    defaultSpeed: Math.random() * 2 + 1,
                    defaultAttack: 1,
                    defaultHealth: 1,
                    enemyNumber:
                        "s" +
                        room.data.currentGame.players[player].currentGame
                            .enemiesCreated +
                        1,
                    senderName: nameToPutOnEnemy
                });
                room.data.currentGame.players[player].currentGame
                    .sentEnemiesToSpawn--;
                room.data.currentGame.players[player].currentGame
                    .enemiesCreated++;
            }
            break;
        }
        default: {
            console.error(
                log.addMetadata(
                    `${room.gameMode} is not a valid game mode!`,
                    "error"
                )
            );
            break;
        }
    }

    for (
        j = 0;
        j <
        room.data.currentGame.players[player].currentGame.enemiesOnField.length;
        j++
    ) {
        if (
            room.data.currentGame.players[player].currentGame.enemiesOnField[
                j
            ] !== undefined
        ) {
            room.data.currentGame.players[player].currentGame.enemiesOnField[
                j
            ].move(
                framesRendered *
                    0.01 *
                    room.data.currentGame.players[player].currentGame
                        .enemiesOnField[j].defaultSpeed
            );
            if (
                room.data.currentGame.players[player].currentGame
                    .enemiesOnField[j].sPosition < 0 &&
                !room.data.currentGame.players[player].currentGame
                    .enemiesOnField[j].reachedBase &&
                !room.data.currentGame.players[player].currentGame
                    .enemiesOnField[j].destroyed
            ) {
                room.data.currentGame.players[
                    player
                ].currentGame.enemiesOnField[j].reachedBase = true;
                room.data.currentGame.players[
                    player
                ].currentGame.baseHealth -= 1;
            }
            if (
                room.data.currentGame.players[player].currentGame
                    .enemiesOnField[j].sPosition < -0.5
            ) {
                room.data.currentGame.players[
                    player
                ].currentGame.enemiesOnField.splice(j, 1);
            }
        }
    }
}

async function computeUpdateForRoomPlayerIndicators(
    room,
    player,
    deltaTimeInMilliseconds
) {
    let indicatorName;
    switch (room.gameMode) {
        case "easySingleplayerMode":
        case "standardSingleplayerMode":
        case "customSingleplayerMode": {
            indicatorName = "scoreGainIndicators";
            break;
        }
        case "defaultMultiplayerMode": {
            indicatorName = "enemiesSentIndicators";
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

    for (
        j = 0;
        j <
        room.data.currentGame.players[player].currentGame[indicatorName].length;
        j++
    ) {
        room.data.currentGame.players[player].currentGame[indicatorName][
            j
        ].ageInMilliseconds += deltaTimeInMilliseconds;
        if (
            room.data.currentGame.players[player].currentGame[indicatorName][j]
                .ageInMilliseconds >= 500
        ) {
            room.data.currentGame.players[player].currentGame[
                `${indicatorName}ToDestroy`
            ].push(
                room.data.currentGame.players[player].currentGame[
                    indicatorName
                ][
                    room.data.currentGame.players[player].currentGame[
                        indicatorName
                    ].indexOf(
                        room.data.currentGame.players[player].currentGame[
                            indicatorName
                        ][j]
                    )
                ]
            );
        }
    }
}

async function computeUpdateForRoomPlayerThingsToRemove(
    room,
    player,
    deltaTimeInMilliseconds
) {
    let indicatorName;

    switch (room.gameMode) {
        case "easySingleplayerMode":
        case "standardSingleplayerMode":
        case "customSingleplayerMode": {
            indicatorName = "scoreGainIndicators";
            break;
        }
        case "defaultMultiplayerMode": {
            indicatorName = "enemiesSentIndicators";
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

    for (
        let i = 0;
        i <
        room.data.currentGame.players[player].currentGame[
            `${indicatorName}ToDestroy`
        ].length;
        i++
    ) {
        delete room.data.currentGame.players[player].currentGame[indicatorName][
            room.data.currentGame.players[player].currentGame[
                `${indicatorName}ToDestroy`
            ][i].toString()
        ];
    }
    room.data.currentGame.players[player].currentGame[
        `${indicatorName}ToDestroy`
    ] = [];

    room.data.currentGame.players[player].currentGame.enemiesOnField =
        room.data.currentGame.players[player].currentGame.enemiesOnField.filter(
            function (element) {
                return element != null || element !== undefined;
            }
        );
}

function startDefaultSingleplayerGame(roomID) {}

/**
 * Submits a singleplayer game.
 * @param {*} socket
 * @param {*} finalGameData
 * @param {*} userIDOfSocketOwner
 * @param {*} gameMode
 * @returns
 */
async function submitDefaultSingleplayerGame(
    socket,
    finalGameData,
    userIDOfSocketOwner,
    gameMode
) {
    // determine mode
    let gameModeAsShortenedString = "";
    if (gameMode == "easySingleplayerMode") {
        gameModeAsShortenedString = "easy";
    } else if (gameMode == "standardSingleplayerMode") {
        gameModeAsShortenedString = "standard";
    } else if (gameMode == "customSingleplayerMode") {
        return;
    } else {
        console.error(
            log.addMetadata(
                `${gameMode} is not a valid Singleplayer game mode!`,
                "error"
            )
        );
        return;
    }
    // check #1
    if (userIDOfSocketOwner === undefined) {
        console.log(
            log.addMetadata(
                `A guest user has submitted a score of ${
                    finalGameData.currentScore
                } on a ${_.startCase(
                    gameModeAsShortenedString
                )} Singleplayer game.`,
                "info"
            )
        );
        socket.emit("finalRanks", false, false, false);
        return;
    }

    let userIDAsString = userIDOfSocketOwner.toString();
    let usernameOfSocketOwner = JSON.parse(
        JSON.stringify(await schemas.getUserModel().findById(userIDAsString))
    ).username;
    let personalBestBroken = false;
    let playerDataOfSocketOwner = await schemas
        .getUserModel()
        .findById(userIDAsString);
    let globalRank = -1;
    let levelStatus = {};

    personalBestBroken = await checkSingleplayerPersonalBestForPlayer(
        userIDAsString,
        finalGameData,
        gameMode,
        usernameOfSocketOwner,
        playerDataOfSocketOwner
    );
    globalRank = await checkAndModifyLeaderboards(
        userIDAsString,
        finalGameData,
        gameMode,
        usernameOfSocketOwner,
        playerDataOfSocketOwner
    );

    socket.emit("finalRanks", personalBestBroken, globalRank, true);

    console.log(
        log.addMetadata(
            globalRank == -1
                ? `User ${usernameOfSocketOwner} submitted a score of ${
                      finalGameData.currentScore
                  } on a ${_.startCase(
                      gameModeAsShortenedString
                  )} Singleplayer game.`
                : `User ${usernameOfSocketOwner} submitted a score of ${
                      finalGameData.currentScore
                  } and reached #${globalRank} on a ${_.startCase(
                      gameModeAsShortenedString
                  )} Singleplayer game.`,
            "info"
        )
    );

    if (globalRank != -1) {
        webhook.createAndSendWebhook(
            usernameOfSocketOwner,
            globalRank,
            finalGameData.currentScore,
            gameModeAsShortenedString
        );
    }

    levelStatus = await checkPlayerLevelStatusForPlayer(
        userIDAsString,
        finalGameData,
        gameMode,
        usernameOfSocketOwner
    );
    socket.emit("levelStatus", levelStatus);
    if (levelStatus.leveledUp) {
        console.log(
            log.addMetadata(
                `User ${usernameOfSocketOwner} leveled up from Level ${
                    levelStatus.currentLevel - 1
                } to Level ${levelStatus.currentLevel}`,
                "info"
            )
        );
    }
}

/**
 * Checks a player's personal best for a Singleplayer game.
 * @param {*} userIDAsString
 * @param {*} finalGameData
 * @param {*} gameMode
 * @param {*} usernameOfSocketOwner
 * @returns Whether the player's personal best is broken.
 */
async function checkSingleplayerPersonalBestForPlayer(
    userIDAsString,
    finalGameData,
    gameMode,
    usernameOfSocketOwner,
    playerDataOfSocketOwner
) {
    let personalBestBroken = false;
    let fieldToUpdate;
    let fullPathOfFieldToUpdate;

    if (gameMode == "easySingleplayerMode") {
        fieldToUpdate = "easyModePersonalBestScore";
    } else if (gameMode == "standardSingleplayerMode") {
        fieldToUpdate = "standardModePersonalBestScore";
    } else {
        console.error(
            log.addMetadata(
                `${gameMode} is not a valid Singleplayer game mode!`,
                "error"
            )
        );
        return;
    }

    if (playerDataOfSocketOwner["statistics"][fieldToUpdate] === undefined) {
        // personal best field doesn't exist
        // so create one, and assign the score to the field
        await schemas.getUserModel().findByIdAndUpdate(
            userIDAsString,
            {
                $set: {
                    [`statistics.${fieldToUpdate}`]: finalGameData.currentScore
                }
            },
            { upsert: true },
            (error3, result3) => {
                if (error3) {
                    // console.log(log.addMetadata("ERROR from Socket " + socket.id + " (" + usernameOfSocketOwner + "): ", "info"));
                    console.error(log.addMetadata(error3.stack, "error"));
                }
                return result3;
            }
        );
        personalBestBroken = true;
    } else {
        // personal best field exists
        if (
            finalGameData.currentScore >
            playerDataOfSocketOwner["statistics"][fieldToUpdate]
        ) {
            // score is higher than personal best
            await schemas.getUserModel().findByIdAndUpdate(
                userIDAsString,
                {
                    $set: {
                        [`statistics.${fieldToUpdate}`]:
                            finalGameData.currentScore
                    }
                },
                { upsert: true },
                (error4, result4) => {
                    if (error4) {
                        console.error(log.addMetadata(error4.stack, "error"));
                    }
                    return result4;
                }
            );
            personalBestBroken = true;
        }
    }
    return personalBestBroken;
}

/**
 * Checks the leaderboards to see if any changes are to be make according to the newly submitted game.
 * @param {*} userIDAsString
 * @param {*} finalGameData
 * @param {*} gameMode
 * @param {*} usernameOfSocketOwner
 * @returns -1 if player did not get Top 50, their rank number otherwise.
 */
async function checkAndModifyLeaderboards(
    userIDAsString,
    finalGameData,
    gameMode,
    usernameOfSocketOwner,
    playerDataOfSocketOwner
) {
    var placePlayerRanked = -1;
    var placePlayerRankedBefore = -1;
    let leaderboardsModel;
    let score = finalGameData.currentScore;

    if (gameMode == "easySingleplayerMode") {
        leaderboardsModel = schemas.getEasyModeLeaderboardsModel();
    } else if (gameMode == "standardSingleplayerMode") {
        leaderboardsModel = schemas.getStandardModeLeaderboardsModel();
    } else {
        console.error(
            log.addMetadata(
                `${gameMode} is not a valid Singleplayer game mode!`,
                "error"
            )
        );
        return;
    }
    // main check #1
    for (var i = 1; i <= 50; i++) {
        var data = await leaderboardsModel.find(
            { rankNumber: i },
            function (error2, result2) {
                if (error2) {
                    console.error(log.addMetadata(error2.stack, "error"));
                }
                return result2;
            }
        );
        if (score > data[0].score) {
            placePlayerRanked = i;
            break;
        }
    }

    if (placePlayerRanked == -1) {
        return -1;
    }
    // main check #2
    for (var i = 1; i < placePlayerRanked; i++) {
        var data = await leaderboardsModel.find(
            { rankNumber: i },
            function (error2, result2) {
                if (error2) {
                    console.error(log.addMetadata(error2.stack, "error"));
                }
                return result2;
            }
        );
        if (userIDAsString == data[0].userIDOfHolder) {
            return placePlayerRanked;
        }
    }
    // middle check #1
    // check if player is already on leaderboard but at a lower rank
    for (var i = placePlayerRanked; i <= 50; i++) {
        var data = await leaderboardsModel.find(
            { rankNumber: i },
            function (error2, result2) {
                if (error2) {
                    console.error(log.addMetadata(error2.stack, "error"));
                }
                return result2;
            }
        );
        if (userIDAsString == data[0].userIDOfHolder) {
            placePlayerRankedBefore = i;
            break;
        }
    }

    if (placePlayerRankedBefore != -1) {
        for (var i = placePlayerRankedBefore; i < 50; i++) {
            var data1 = await leaderboardsModel.findOne({ rankNumber: i + 1 });
            await leaderboardsModel.findOneAndUpdate(
                { rankNumber: i },
                { userIDOfHolder: data1.userIDOfHolder, score: data1.score },
                function (error4, result4) {
                    if (error4) {
                        console.error(log.addMetadata(error4.stack, "error"));
                    }
                    return result4;
                }
            );
        }
    }
    // modify
    for (var i = 50; i >= placePlayerRanked; i--) {
        if (i != 1) {
            var data1 = await leaderboardsModel.findOne({ rankNumber: i - 1 });
            await leaderboardsModel.findOneAndUpdate(
                { rankNumber: i },
                { userIDOfHolder: data1.userIDOfHolder, score: data1.score },
                function (error4, result4) {
                    if (error4) {
                        console.error(log.addMetadata(error4.stack, "error"));
                    }
                    return result4;
                }
            );
        }
    }

    await leaderboardsModel.findOneAndUpdate(
        { rankNumber: placePlayerRanked },
        { userIDOfHolder: userIDAsString, score: score },
        function (error5, result5) {
            if (error5) {
                console.error(log.addMetadata(error5.stack, "error"));
            }
            return result5;
        }
    );
    return placePlayerRanked;
}

/**
 * Gives and checks the player's experience points.
 * @param {*} userIDAsString
 * @param {*} finalGameData
 * @param {*} gameMode
 * @param {*} usernameOfSocketOwner
 * @returns An object.
 */
async function checkPlayerLevelStatusForPlayer(
    userIDAsString,
    finalGameData,
    gameMode,
    usernameOfSocketOwner
) {
    let divisor = gameMode == "easySingleplayerMode" ? 200 : 100;
    return leveling.giveExperiencePointsToPlayerID(
        userIDAsString,
        Math.floor(finalGameData.currentScore / divisor)
    );
}

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
                    socket.id
                ].currentGame.sentEnemiesToSpawn +=
                    room.data.currentGame.players[
                        socket.id
                    ].currentGame.enemiesPending;
                room.data.currentGame.players[
                    socket.id
                ].currentGame.enemiesPending = 0;
            }
            break;
        }
    }
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
                socket.id
            ].currentGame.currentProblemAsText.match("=") || []
        ).length
    ) {
        case 0: {
            let originalProblem =
                room.data.currentGame.players[socket.id].currentGame
                    .currentProblemAsText;
            let problemToEvaluate = fixProblem(originalProblem);
            let result = calculateProblem(problemToEvaluate, room, socket);
            let hasResults = evaluateProblemResult(result, room, socket);
            return hasResults;
        }
        case 1: {
            let originalProblem =
                room.data.currentGame.players[socket.id].currentGame
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

// end

/**
 * <========= MULTIPLAYER ROOM FUNCTIONS =========>
 */

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
        room.data.currentGame.players[socket.id].currentGame
            .currentProblemAsText;
    if (result) {
        // evaluate calculated string
        for (
            i = 0;
            i <
            room.data.currentGame.players[socket.id].currentGame.enemiesOnField
                .length;
            i++
        ) {
            requestedValues.push(
                room.data.currentGame.players[socket.id].currentGame
                    .enemiesOnField[i] === undefined &&
                    room.data.currentGame.players[socket.id].currentGame
                        .enemiesOnField[i].sPosition < 0
                    ? undefined
                    : room.data.currentGame.players[socket.id].currentGame
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
                    room.data.currentGame.players[socket.id].currentGame
                        .enemiesOnField[i]
                );
            }
        }
        if (answers > 0 && result !== undefined) {
            killPlayerRoomEnemies(enemiesToKill, room, socket);
            replacePlayerRoomTiles(room, socket);
            enemiesToKill = [];
            hasAnswers = true;
        }
        return hasAnswers;
    } else {
        // evaluate RAW result (i.e. the problem string itself)
        for (
            i = 0;
            i <
            room.data.currentGame.players[socket.id].currentGame.enemiesOnField
                .length;
            i++
        ) {
            requestedValues.push(
                room.data.currentGame.players[socket.id].currentGame
                    .enemiesOnField[i] === undefined &&
                    room.data.currentGame.players[socket.id].currentGame
                        .enemiesOnField[i].sPosition < 0
                    ? undefined
                    : room.data.currentGame.players[socket.id].currentGame
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
                    room.data.currentGame.players[socket.id].currentGame
                        .enemiesOnField[i]
                );
            }
        }
        if (answers > 0 && result !== undefined) {
            killPlayerRoomEnemies(enemiesToKill, room, socket);
            replacePlayerRoomTiles(room, socket);
            enemiesToKill = [];
            hasAnswers = true;
        }
        return hasAnswers;
    }
}

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
            for (i = 0; i < enemiesToKill.length; i++) {
                // Reset counter
                room.data.currentGame.players[
                    socket.id
                ].currentGame.framesElapsedSinceLastEnemyKill = 0;
                room.data.currentGame.players[
                    socket.id
                ].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds = 0;

                room.data.currentGame.players[socket.id].currentGame
                    .currentCombo++;

                room.data.currentGame.players[
                    socket.id
                ].currentGame.currentScore += Math.round(
                    100 *
                        calculateProblemLengthMultiplier(
                            room.data.currentGame.players[socket.id].currentGame
                                .currentProblemAsText.length
                        ) *
                        calculateComboMultiplier(
                            room.data.currentGame.players[socket.id].currentGame
                                .currentCombo
                        ) *
                        calculateEnemyPositionMultiplier(
                            enemiesToKill[i].sPosition
                        )
                );

                room.data.currentGame.players[
                    socket.id
                ].currentGame.scoreGainIndicators.push({
                    number:
                        room.data.currentGame.players[socket.id].currentGame
                            .enemiesKilled + 1,
                    sPosition: enemiesToKill[i].sPosition,
                    content:
                        "+" +
                        Math.round(
                            100 *
                                calculateProblemLengthMultiplier(
                                    room.data.currentGame.players[socket.id]
                                        .currentGame.currentProblemAsText.length
                                ) *
                                calculateComboMultiplier(
                                    room.data.currentGame.players[socket.id]
                                        .currentGame.currentCombo
                                ) *
                                calculateEnemyPositionMultiplier(
                                    enemiesToKill[i].sPosition
                                )
                        ).toString(),
                    ageInMilliseconds: 0
                });

                room.data.currentGame.players[
                    socket.id
                ].currentGame.enemiesOnField[
                    room.data.currentGame.players[
                        socket.id
                    ].currentGame.enemiesOnField.indexOf(enemiesToKill[i])
                ].toDestroy = true;

                room.data.currentGame.players[socket.id].currentGame
                    .enemiesKilled++;
            }
            break;
        }
        case "defaultMultiplayerMode": {
            indicatorName = "enemiesSentIndicators";
            statToAddTo = "enemiesSent";
            for (i = 0; i < enemiesToKill.length; i++) {
                // Reset counter
                room.data.currentGame.players[
                    socket.id
                ].currentGame.framesElapsedSinceLastEnemyKill = 0;
                room.data.currentGame.players[
                    socket.id
                ].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds = 0;

                room.data.currentGame.players[socket.id].currentGame
                    .currentCombo++;

                let enemiesSent = Math.floor(
                    ((room.data.currentGame.players[socket.id].currentGame
                        .currentProblemAsText.length -
                        3) /
                        1.05 +
                        (room.data.currentGame.players[socket.id].currentGame
                            .currentCombo -
                            2) +
                        (enemiesToKill[i].sPosition - 5) / 1.25 +
                        2) /
                        1.25
                );

                room.data.currentGame.players[
                    socket.id
                ].currentGame.enemiesSent += Math.max(0, enemiesSent);

                let playerToSendEnemiesTo = _.sample(
                    room.data.currentGame.players
                );
                while (
                    playerToSendEnemiesTo.currentGame.connectionID == socket.id
                ) {
                    playerToSendEnemiesTo = _.sample(
                        room.data.currentGame.players
                    );
                }

                room.data.currentGame.players[
                    socket.id
                ].currentGame.enemiesSentIndicators.push({
                    number:
                        room.data.currentGame.players[socket.id].currentGame
                            .enemiesKilled + 1,
                    sPosition: enemiesToKill[i].sPosition,
                    content: Math.max(0, enemiesSent).toString(),
                    ageInMilliseconds: 0
                });

                while (enemiesSent > 0) {
                    if (
                        room.data.currentGame.players[socket.id].currentGame
                            .enemiesPending <= 0
                    ) {
                        room.data.currentGame.players[
                            playerToSendEnemiesTo.currentGame.connectionID
                        ].currentGame.enemiesPending += 1;
                        room.data.currentGame.players[
                            playerToSendEnemiesTo.currentGame.connectionID
                        ].currentGame.enemySenders.push(
                            room.data.currentGame.players[socket.id].currentGame
                                .playerName
                        );
                    } else {
                        room.data.currentGame.players[
                            socket.id
                        ].currentGame.enemiesPending -= 1;
                    }
                    enemiesSent--;
                }

                room.data.currentGame.players[
                    socket.id
                ].currentGame.enemiesOnField[
                    room.data.currentGame.players[
                        socket.id
                    ].currentGame.enemiesOnField.indexOf(enemiesToKill[i])
                ].toDestroy = true;

                room.data.currentGame.players[socket.id].currentGame
                    .enemiesKilled++;
            }
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
                    socket.id
                ].currentGame.valueOfVariableA = calculateProblem(
                    problemOnRightSide,
                    room,
                    socket
                );
                break;
            }
            case "b": {
                room.data.currentGame.players[
                    socket.id
                ].currentGame.valueOfVariableB = calculateProblem(
                    problemOnRightSide,
                    room,
                    socket
                );
                break;
            }
            case "c": {
                room.data.currentGame.players[
                    socket.id
                ].currentGame.valueOfVariableC = calculateProblem(
                    problemOnRightSide,
                    room,
                    socket
                );
                break;
            }
            case "d": {
                room.data.currentGame.players[
                    socket.id
                ].currentGame.valueOfVariableD = calculateProblem(
                    problemOnRightSide,
                    room,
                    socket
                );
                break;
            }
        }
        replacePlayerRoomTiles(room, socket);
        return true;
    }
    return false;
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
                room.data.currentGame.players[socket.id].currentGame
                    .tilesInCurrentProblem.length;
                i++
            ) {
                let t = new tile.Tile(
                    generateRandomTileTermID(room, socket.id),
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

/**
 * Generates a tile ID for a Singleplayer room.
 * @param {*} room
 * @returns
 */
function generateRandomTileTermID(room, player) {
    let roll =
        room.data.currentGame.players[player].currentGame.availableTermsIndexes[
            Math.floor(
                Math.random() *
                    room.data.currentGame.players[player].currentGame
                        .availableTermsIndexes.length
            )
        ];
    let toReturn = roll;
    room.data.currentGame.players[player].currentGame.bagQuantities[roll]--;
    if (
        room.data.currentGame.players[player].currentGame.bagQuantities[roll] <=
        0
    ) {
        room.data.currentGame.players[
            player
        ].currentGame.availableTermsIndexes.splice(
            room.data.currentGame.players[
                player
            ].currentGame.availableTermsIndexes.indexOf(roll),
            1
        );
        if (
            room.data.currentGame.players[player].currentGame
                .availableTermsIndexes.length <= 0
        ) {
            room.data.currentGame.players[player].currentGame.bagQuantities = [
                4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2
            ];
            room.data.currentGame.players[
                player
            ].currentGame.availableTermsIndexes = [
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
            ];
        }
    }
    return toReturn;
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
                a: room.data.currentGame.players[socket.id].currentGame
                    .valueOfVariableA,
                b: room.data.currentGame.players[socket.id].currentGame
                    .valueOfVariableB,
                c: room.data.currentGame.players[socket.id].currentGame
                    .valueOfVariableC,
                d: room.data.currentGame.players[socket.id].currentGame
                    .valueOfVariableD
            }
        );
    } catch (error) {
        return null;
    }
}

function calculateProblemLengthMultiplier(problemLength) {
    if (problemLength < 7) {
        return 1;
    } else if (problemLength < 14) {
        return 1 + 0.1 * (problemLength - 6);
    } else {
        return 1 + 0.2 * (problemLength - 9);
    }
}

function calculateEnemyPositionMultiplier(sPosition) {
    return sPosition < 5 ? 1 : 1 + 0.1 * Math.floor(sPosition - 5);
}

function calculateComboMultiplier(combo) {
    return 1 + 0.1 * Math.max(combo, 0);
}

function convertTermIDToTerm(id) {
    return TERMS[id];
}

function convertTermIDToBeautifulString(id) {
    return TERMS_AS_BEAUTIFUL_STRINGS[id];
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

function convertPressedKeyToTermID(keyPressed, playerKeybinds, room, socket) {
    if (keyPressed == "Space") {
        // space
        checkProblem(room, socket);
        return;
    } else if (keyPressed == "Period" || keyPressed == "Backspace") {
        //numpad decimal
        deleteLastSelectedTerm(room, socket);
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

function deleteLastSelectedTerm(room, socket) {
    if (
        room.data.currentGame.players[socket.id].currentGame
            .tilesInCurrentProblem.length > 0
    ) {
        processTileClick(
            room.data.currentGame.players[socket.id].currentGame
                .tilesInCurrentProblem[
                room.data.currentGame.players[socket.id].currentGame
                    .tilesInCurrentProblem.length - 1
            ],
            room,
            socket
        );
    }
}

function forceSelectTileWithTermID(termIDToSelect, room, socket) {
    for (i = 0; i < 49; i++) {
        if (
            room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[i]
                .termID == termIDToSelect &&
            room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[i]
                .selected == false
        ) {
            processTileClick(i, room, socket);
            return; // break
        }
    }
}

function processTileClick(slot, room, socket) {
    if (socket.currentRoomSocketIsIn != "") {
        room.data.currentGame.players[socket.id].currentGame.actionsPerformed++;
        room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[
            slot
        ].selected =
            !room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[
                slot
            ].selected;
        if (
            room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[
                slot
            ].selected
        ) {
            room.data.currentGame.players[
                socket.id
            ].currentGame.tilesInCurrentProblem.push(slot);
            room.data.currentGame.players[
                socket.id
            ].currentGame.currentProblemAsText += convertTermIDToTerm(
                room.data.currentGame.players[socket.id].currentGame
                    .tilesOnBoard[slot].termID
            );
            room.data.currentGame.players[
                socket.id
            ].currentGame.currentProblemAsBeautifulText += convertTermIDToBeautifulString(
                room.data.currentGame.players[socket.id].currentGame
                    .tilesOnBoard[slot].termID
            );
        } else {
            let index =
                room.data.currentGame.players[
                    socket.id
                ].currentGame.tilesInCurrentProblem.indexOf(slot);
            room.data.currentGame.players[
                socket.id
            ].currentGame.tilesInCurrentProblem.splice(index, 1);
            let temp =
                room.data.currentGame.players[
                    socket.id
                ].currentGame.currentProblemAsText.split("");
            temp.splice(index, 1);
            room.data.currentGame.players[
                socket.id
            ].currentGame.currentProblemAsText = temp.join("");
            let temp2 =
                room.data.currentGame.players[
                    socket.id
                ].currentGame.currentProblemAsBeautifulText.split("");
            temp2.splice(index, 1);
            room.data.currentGame.players[
                socket.id
            ].currentGame.currentProblemAsBeautifulText = temp2.join("");
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

function performDataValidationForCustomSingleplayerMode(settings) {
    let toReturn = {
        good: true,
        problems: {}
    };

    let allowedValueRanges = {
        baseHealth: {
            minimum: 1,
            maximum: 100
        },
        allowedComboTimeInMilliseconds: {
            minimum: 1,
            maximum: 60 * 1000
        },
        enemyGenerationThreshold: {
            minimum: 1,
            maximum: 100
        },
        enemyGenerationIntervalInMilliseconds: {
            minimum: 10,
            maximum: 60 * 1000
        },
        enemySpeedMultiplier: {
            minimum: 0.1,
            maximum: 100
        },
        enemyLimit: {
            minimum: 1,
            maximum: 250
        },
        valueOfVariableA: {
            minimum: -2147483648,
            maximum: 2147483647
        },
        valueOfVariableB: {
            minimum: -2147483648,
            maximum: 2147483647
        },
        valueOfVariableC: {
            minimum: -2147483648,
            maximum: 2147483647
        },
        valueOfVariableD: {
            minimum: -2147483648,
            maximum: 2147483647
        }
    };

    let keys = Object.keys(settings);

    for (i = 0; i < keys.length; i++) {
        // check that supplied value is a number
        if (/^([0-9]\d*)(\.\d+)?$/.test(settings[keys[i]]) || (/(valueOfVariable)[A-D]/.test(Object.keys(settings)[i]) && (/^([0-9]\d*)(\.\d+)?$/.test(settings[keys[i]]) ||  "" == settings[keys[i]]))) {
            // good - check if value is within limit
            if (allowedValueRanges[keys[i]]) {
                if (
                    (allowedValueRanges[keys[i]].minimum <=
                        parseInt(settings[keys[i]]) &&
                    parseInt(settings[keys[i]]) <=
                        allowedValueRanges[keys[i]].maximum)
                ) {
                    // good
                } else {
                    // bad - check one more time that its a variable
                    if (
                        (/(valueOfVariable)[A-D]/.test(Object.keys(settings)[i]) && (/^([0-9]\d*)(\.\d+)?$/.test(settings[keys[i]]) ||  "" == settings[keys[i]]))
                    ) {
                        // good
                    } else {



                    toReturn.good = false;
                    toReturn.problems[keys[i]] = {
                        message: `Value for ${keys[i]} must be in the range [${
                            allowedValueRanges[keys[i]].minimum
                        }, ${allowedValueRanges[keys[i]].maximum}].`
                    };
                }
                }
            }
        } else {
            // bad
            toReturn.good = false;
            toReturn.problems[keys[i]] = {
                message: `Value for ${keys[i]} is not a number.`
            };
        }
    }

    return toReturn;
}

function getCustomSingleplayerRoomInstance(room, player) {
    return room.data.currentGame.players[player].currentGame;
}

module.exports = {
    // major
    computeUpdate,

    startDefaultSingleplayerGame,
    submitDefaultSingleplayerGame,

    // minor
    checkProblem,
    evaluateProblem,
    generateRandomTileTermID,
    calculateProblem,
    calculateProblemLengthMultiplier,
    calculateEnemyPositionMultiplier,
    calculateComboMultiplier,
    convertTermIDToTerm,
    convertTermIDToBeautifulString,
    convertPressedKeyToTermID,
    deleteLastSelectedTerm,
    forceSelectTileWithTermID,
    processTileClick,
    generateRandomEnemyTerm,
    generateMultiplayerTileQueue,
    performDataValidationForCustomSingleplayerMode
};
