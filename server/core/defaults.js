const modes = {
    SINGLEPLAYER: "singleplayer",
    EASY_SINGLEPLAYER: "easySingleplayerMode",
    STANDARD_SINGLEPLAYER: "standardSingleplayerMode",
    DEFAULT_MULTIPLAYER: "defaultMultiplayerMode",
    MULTIPLAYER: "multiplayer"
};

function createNewDefaultSingleplayerGameData(mode, roomID, gameMode, socket) {
    let data = {
        id: roomID,
        mode: modes.SINGLEPLAYER,
        gameMode: gameMode,
        currentGame: {
            players: {
                [socket.id]: {
                    currentGame: {
                        mode: mode,

                        gameMode: gameMode,
                        currentScore: 0,
                        currentInGameTimeInMilliseconds: 0,
                        actionsPerformed: 0,

                        currentCombo: -1,

                        enemiesCreated: 0,
                        enemiesKilled: 0,
                        enemiesOnField: [],
                        enemiesToKill: [],

                        tilesCreated: 0,
                        tilesOnBoard: [],
                        bagQuantities: [
                            4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2,
                            2, 2
                        ],
                        availableTermsIndexes: [
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
                            15, 16, 17, 18
                        ],

                        framesRenderedSinceGameStart: 0,
                        enemyGenerationElapsedTimeCounterInMilliseconds: 0,
                        timeElapsedSinceLastEnemyKillInMilliseconds: 0,

                        baseHealth: 10,

                        scoreGainIndicators: [],
                        scoreGainIndicatorsToDestroy: [],

                        currentProblemAsText: "",
                        currentProblemAsBeautifulText: "",
                        tilesInCurrentProblem: [],

                        valueOfVariableA: undefined,
                        valueOfVariableB: undefined,
                        valueOfVariableC: undefined,
                        valueOfVariableD: undefined,

                        dead: false,

                        gameIsOver: false,
                        gameOverScreenShown: false
                    }
                }
            }
        }
    };
    return data;
}

function createNewCustomSingleplayerGameData(
    mode,
    roomID,
    gameMode,
    socket,
    settings
) {
    let data = {
        id: roomID,
        mode: modes.SINGLEPLAYER,
        gameMode: gameMode,
        currentGame: {
            players: {
                [socket.id]: {
                    currentGame: {
                        mode: mode,

                        gameMode: gameMode,
                        currentScore: 0,
                        currentInGameTimeInMilliseconds: 0,
                        actionsPerformed: 0,

                        currentCombo: -1,

                        enemiesCreated: 0,
                        enemiesKilled: 0,
                        enemiesOnField: [],
                        enemiesToKill: [],

                        tilesCreated: 0,
                        tilesOnBoard: [],
                        bagQuantities: [
                            4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2,
                            2, 2
                        ],
                        availableTermsIndexes: [
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
                            15, 16, 17, 18
                        ],

                        framesRenderedSinceGameStart: 0,
                        enemyGenerationElapsedTimeCounterInMilliseconds: 0,
                        timeElapsedSinceLastEnemyKillInMilliseconds: 0,

                        baseHealth: settings.baseHealth || 10,

                        scoreGainIndicators: [],
                        scoreGainIndicatorsToDestroy: [],

                        currentProblemAsText: "",
                        currentProblemAsBeautifulText: "",
                        tilesInCurrentProblem: [],

                        valueOfVariableA: settings.valueOfVariableA,
                        valueOfVariableB: settings.valueOfVariableB,
                        valueOfVariableC: settings.valueOfVariableC,
                        valueOfVariableD: settings.valueOfVariableD,

                        dead: false,

                        gameIsOver: false,
                        gameOverScreenShown: false,

                        // custom
                        allowedComboTimeInMilliseconds:
                            settings.allowedComboTimeInMilliseconds,
                        enemyGenerationThreshold:
                            1 - settings.enemyGenerationThreshold / 100,
                        enemyGenerationIntervalInMilliseconds:
                            settings.enemyGenerationIntervalInMilliseconds,
                        enemySpeedMultiplier: settings.enemySpeedMultiplier,
                        enemyLimit: settings.enemyLimit
                    }
                }
            }
        }
    };
    return data;
}

// TODO: Unused?
function createNewDefaultMultiplayerGameData(roomID, socket) {
    let data = {
        id: roomID,
        mode: modes.DEFAULT_MULTIPLAYER,
        currentGame: {
            players: {
                [socket.id]: {
                    playerName: socket.loggedIn
                        ? socket.usernameOfSocketOwner
                        : socket.guestNameOfSocketOwner,

                    currentInGameTimeInMilliseconds: 0,
                    actionsPerformed: 0,

                    currentCombo: -1,

                    enemiesPending: 0,
                    sentEnemiesToSpawn: 0,
                    enemySenders: [],

                    enemiesCreated: 0,
                    enemiesKilled: 0,
                    enemiesOnField: [],
                    enemiesToKill: [],

                    tilesCreated: 0,
                    tilesOnBoard: [],
                    tileQueue: [],
                    bagQuantities: [
                        4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2
                    ],
                    availableTermsIndexes: [
                        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                        16, 17, 18
                    ],

                    framesRenderedSinceGameStart: 0,
                    enemyGenerationElapsedTimeCounterInMilliseconds: 0,
                    timeElapsedSinceLastEnemyKillInMilliseconds: 0,

                    baseHealth: 10,

                    scoreGainIndicators: [],
                    scoreGainIndicatorsToDestroy: [],

                    currentProblemAsText: "",
                    currentProblemAsBeautifulText: "",
                    tilesInCurrentProblem: [],

                    valueOfVariableA: undefined,
                    valueOfVariableB: undefined,
                    valueOfVariableC: undefined,
                    valueOfVariableD: undefined,

                    gameIsOver: false,
                    gameOverScreenShown: false,

                    // leveling
                    experiencePointsEarned: 0
                }
            }
        }
    };
    return data;
}

function createNewDefaultMultiplayerRoomPlayerObject(socket) {
    let data = {
        playerName: socket.loggedIn
            ? socket.usernameOfSocketOwner
            : socket.guestNameOfSocketOwner,
        playerRank: socket.playerRank,
        connectionID: socket.id,

        dead: false,

        enemiesSent: 0,

        currentInGameTimeInMilliseconds: 0,

        actionsPerformed: 0,

        currentCombo: -1,

        enemiesCreated: 0,
        enemiesKilled: 0,
        enemiesOnField: [],
        enemiesToKill: [],

        enemiesPending: 0,
        sentEnemiesToSpawn: 0,
        enemySenders: [],

        currentTileQueue: 1,

        tilesCreated: 0,
        tilesOnBoard: [],
        tileQueue: [],
        bagQuantities: [
            4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2
        ],
        availableTermsIndexes: [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
        ],

        framesRenderedSinceGameStart: 0,
        enemyGenerationElapsedTimeCounterInMilliseconds: 0,
        timeElapsedSinceLastEnemyKillInMilliseconds: 0,

        baseHealth: 10,

        enemiesSentIndicators: [],
        enemiesSentIndicatorsToDestroy: [],

        currentProblemAsText: "",
        currentProblemAsBeautifulText: "",
        tilesInCurrentProblem: [],

        valueOfVariableA: undefined,
        valueOfVariableB: undefined,
        valueOfVariableC: undefined,
        valueOfVariableD: undefined,

        gameIsOver: false,
        gameOverScreenShown: false
    };
    return data;
}

module.exports = {
    createNewDefaultSingleplayerGameData,
    createNewCustomSingleplayerGameData,
    createNewDefaultMultiplayerGameData,
    createNewDefaultMultiplayerRoomPlayerObject
};
