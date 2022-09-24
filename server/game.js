const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const log = require("./core/log.js");

const _ = require("lodash");

const credentials = require("../credentials/credentials.js");

const enemy = require("./game/constructors/enemy.js");
const tile = require("./game/constructors/tile.js");
const leveling = require("./game/leveling.js");
const enemies = require("./game/enemies.js");
const leaderboards = require("./game/leaderboards.js");
const utilities = require("./game/utilities.js");
const personalbests = require("./game/personalbests.js");
const global = require("./global.js");

const mexp = require("math-expression-evaluator");

const FRAMES_PER_SECOND = 60;

const defaults = require("./core/defaults.js");

// models
var User = require("./models/User.js");
var EasyModeLeaderboardsRecord = require("./models/EasyModeLeaderboardsRecord.js");
var StandardModeLeaderboardsRecord = require("./models/StandardModeLeaderboardsRecord.js");

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
  customSingleplayerMode: {},
  defaultMultiplayerMode: {
    allowedComboTimeInMilliseconds: 5000,
    enemyGenerationThreshold: 0.95,
    enemyGenerationIntervalInMilliseconds: 50,
    enemySpeedMultiplier: 1,
    enemyLimit: 250
  }
};

var socketEventQueue = [];

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
      room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds >
      GAME_SETTINGS[room.gameMode].enemyGenerationIntervalInMilliseconds
    ) {
      if (Math.random() > 0.95) {
        room.data.currentGame.globalEnemyToAdd = new enemy.Enemy({
          xPosition: 1360,
          yPosition: 120,
          width: 100,
          height: 100,
          requestedValue: enemies.generateRandomEnemyTerm(),
          defaultSpeed: Math.random() * 2 + 1,
          defaultAttack: 1,
          defaultHealth: 1,
          enemyNumber: room.data.currentGame.globalEnemiesCreated + 1
        });
        room.data.currentGame.globalEnemiesCreated++;
      }
      room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds -=
        GAME_SETTINGS[room.gameMode].enemyGenerationIntervalInMilliseconds;
    } else {
      room.data.currentGame.globalEnemyToAdd = null;
    }
  }
}

async function computeUpdateForRoom(room, deltaTimeInMilliseconds) {
  let framesRendered = (deltaTimeInMilliseconds * FRAMES_PER_SECOND) / 1000;
  room.updateRound += 1;
  // counters
  // general stats
  room.data.currentGame.currentInGameTimeInMilliseconds +=
    deltaTimeInMilliseconds;
  room.data.currentGame.framesRenderedSinceGameStart += framesRendered;
  let playersAliveThisUpdate = room.data.currentGame.playersAlive;
  for (let i = 0; i < playersAliveThisUpdate.length; i++) {
    let player = playersAliveThisUpdate[i];
    if (room.data.currentGame.players[player]) {
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
      computeUpdateForRoomPlayerEnemies(room, player, deltaTimeInMilliseconds);
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

      computeUpdateForRoomPlayerExperiencePoints(
        room,
        player,
        deltaTimeInMilliseconds
      );
    }
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
      if (room.data.currentGame.players[player].currentGame.baseHealth <= 0) {
        room.data.currentGame.players[player].currentGame.dead = true;
        room.playing = false;
        room.data.currentGame.gameIsOver = true;
        room.data.currentGame.players[player].currentGame.gameIsOver = true;
        let socketOfGamePlayed = room.host;
        let finalGameData = JSON.parse(JSON.stringify(room.data));
        finalGameData.currentGame.players[
          player
        ].currentGame.scoreSubmissionDateAndTime = new Date();

        socketOfGamePlayed.send(
          JSON.stringify({
            action: "currentGameData",

            arguments: {
              data: finalGameData.currentGame.players[player]
            }
          })
        );
        // socketOfGamePlayed.to(room.id).emit(
        //     "currentGameData",
        //     // JSON.stringify(
        //     finalGameData.currentGame.players[player]
        //     // )
        // );
        room.host.unsubscribe(room.id);
        socketOfGamePlayed.variables.currentRoomSocketIsIn = "";
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
      if (room.data.currentGame.players[player].currentGame.baseHealth <= 0) {
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
          room.data.currentGame.players[player].currentGame.enemiesOnField
            .length <
            (room.gameMode == "customSingleplayerMode"
              ? getCustomSingleplayerRoomInstance(room, player)
              : GAME_SETTINGS[room.gameMode]
            ).enemyLimit
        ) {
          room.data.currentGame.players[player].currentGame.enemiesOnField[
            room.data.currentGame.players[player].currentGame.enemiesCreated
          ] = new enemy.Enemy({
            xPosition: 1360,
            yPosition: 120,
            width: 100,
            height: 100,
            requestedValue: enemies.generateRandomEnemyTerm(),
            defaultSpeed:
              (room.gameMode == "customSingleplayerMode"
                ? getCustomSingleplayerRoomInstance(room, player)
                : GAME_SETTINGS[room.gameMode]
              ).enemySpeedMultiplier *
              (Math.random() * 2 + 1),
            defaultAttack: 1,
            defaultHealth: 1,
            enemyNumber:
              room.data.currentGame.players[player].currentGame.enemiesCreated +
              1
          });
          room.data.currentGame.players[player].currentGame.enemiesCreated++;
        }
        room.data.currentGame.players[
          player
        ].currentGame.enemyGenerationElapsedTimeCounterInMilliseconds -= (
          room.gameMode == "customSingleplayerMode"
            ? getCustomSingleplayerRoomInstance(room, player)
            : GAME_SETTINGS[room.gameMode]
        ).enemyGenerationIntervalInMilliseconds;
      }
      break;
    }
    case "defaultMultiplayerMode": {
      if (room.data.currentGame.globalEnemyToAdd) {
        room.data.currentGame.players[player].currentGame.enemiesOnField[
          room.data.currentGame.players[player].currentGame.enemiesCreated
        ] = _.cloneDeep(room.data.currentGame.globalEnemyToAdd);
        room.data.currentGame.players[player].currentGame.enemiesCreated++;
      }
      if (
        room.data.currentGame.players[player].currentGame.sentEnemiesToSpawn >
          0 &&
        room.data.currentGame.players[player].currentGame.enemiesOnField
          .length <
          (room.gameMode == "customSingleplayerMode"
            ? getCustomSingleplayerRoomInstance(room, player)
            : GAME_SETTINGS[room.gameMode]
          ).enemyLimit
      ) {
        let nameToPutOnEnemy =
          room.data.currentGame.players[player].currentGame.enemySenders[0];
        room.data.currentGame.players[player].currentGame.enemySenders.splice(
          0,
          1
        );
        room.data.currentGame.players[player].currentGame.enemiesOnField[
          room.data.currentGame.players[player].currentGame.enemiesCreated
        ] = new enemy.Enemy({
          xPosition: 1360,
          yPosition: 120,
          width: 100,
          height: 100,
          requestedValue: enemies.generateRandomEnemyTerm(),
          defaultSpeed: Math.random() * 2 + 1,
          defaultAttack: 1,
          defaultHealth: 1,
          enemyNumber:
            "s" +
            room.data.currentGame.players[player].currentGame.enemiesCreated +
            1,
          senderName: nameToPutOnEnemy
        });
        room.data.currentGame.players[player].currentGame.sentEnemiesToSpawn--;
        room.data.currentGame.players[player].currentGame.enemiesCreated++;
      }
      break;
    }
    default: {
      console.error(
        log.addMetadata(`${room.gameMode} is not a valid game mode!`, "error")
      );
      break;
    }
  }

  for (
    j = 0;
    j < room.data.currentGame.players[player].currentGame.enemiesOnField.length;
    j++
  ) {
    if (
      room.data.currentGame.players[player].currentGame.enemiesOnField[j] !==
      undefined
    ) {
      room.data.currentGame.players[player].currentGame.enemiesOnField[j].move(
        framesRendered *
          0.01 *
          room.data.currentGame.players[player].currentGame.enemiesOnField[j]
            .defaultSpeed
      );
      if (
        room.data.currentGame.players[player].currentGame.enemiesOnField[j]
          .sPosition < 0 &&
        !room.data.currentGame.players[player].currentGame.enemiesOnField[j]
          .reachedBase &&
        !room.data.currentGame.players[player].currentGame.enemiesOnField[j]
          .destroyed
      ) {
        room.data.currentGame.players[player].currentGame.enemiesOnField[
          j
        ].reachedBase = true;
        room.data.currentGame.players[player].currentGame.baseHealth -= 1;
      }
      if (
        room.data.currentGame.players[player].currentGame.enemiesOnField[j]
          .sPosition < -0.5
      ) {
        room.data.currentGame.players[player].currentGame.enemiesOnField.splice(
          j,
          1
        );
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
        log.addMetadata(`${room.gameMode} is not a valid game mode!`, "error")
      );
    }
  }

  for (
    j = 0;
    j < room.data.currentGame.players[player].currentGame[indicatorName].length;
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
        room.data.currentGame.players[player].currentGame[indicatorName][
          room.data.currentGame.players[player].currentGame[
            indicatorName
          ].indexOf(
            room.data.currentGame.players[player].currentGame[indicatorName][j]
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
        log.addMetadata(`${room.gameMode} is not a valid game mode!`, "error")
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

async function computeUpdateForRoomPlayerExperiencePoints(
  room,
  player,
  deltaTimeInMilliseconds
) {
  if (room.gameMode === "defaultMultiplayerMode") {
    room.data.currentGame.players[player].currentGame.experiencePointsEarned +=
      deltaTimeInMilliseconds / 1000;
  }
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
    // guest user playing
    console.log(
      log.addMetadata(
        `A guest user has submitted a score of ${
          finalGameData.currentScore
        } on a ${_.startCase(gameModeAsShortenedString)} Singleplayer game.`,
        "info"
      )
    );
    socket.send(
      JSON.stringify({
        action: "updateText",
        arguments: {
          selector: "#personal-best-broken",
          text: "Score not saved. Register for an account to save your scores."
        }
      })
    );
    socket.send(
      JSON.stringify({
        action: "updateCSS",
        arguments: {
          selector: "#account-stats-gained",
          property: "display",
          value: "none"
        }
      })
    );
    return;
  }

  //registered player playing
  let userIDAsString = userIDOfSocketOwner.toString();
  let usernameOfSocketOwner = JSON.parse(
    JSON.stringify(await User.findById(userIDAsString))
  ).username;
  let personalBestBroken = false;
  let playerDataOfSocketOwner = await User.findById(userIDAsString);
  let globalRank = -1;
  let levelStatus = {};

  personalBestBroken =
    await personalbests.checkSingleplayerPersonalBestForPlayer(
      userIDAsString,
      finalGameData,
      gameMode,
      usernameOfSocketOwner,
      playerDataOfSocketOwner
    );
  globalRank = await leaderboards.checkAndModifyLeaderboards(
    userIDAsString,
    finalGameData,
    gameMode,
    usernameOfSocketOwner,
    playerDataOfSocketOwner
  );

  socket.send(
    JSON.stringify({
      action: "updateText",
      arguments: {
        selector: "#personal-best-broken",
        text: personalBestBroken ? "New Personal Best!" : ""
      }
    })
  );
  socket.send(
    JSON.stringify({
      action: "updateText",
      arguments: {
        selector: "#final-global-rank",
        text: utilities.calculateMessageForGlobalRank(globalRank)
      }
    })
  );
  socket.send(
    JSON.stringify({
      action: "updateCSS",
      arguments: {
        selector: "#account-stats-gained",
        property: "display",
        value: "block"
      }
    })
  );

  console.log(
    log.addMetadata(
      globalRank == -1
        ? `User ${usernameOfSocketOwner} submitted a score of ${
            finalGameData.currentScore
          } on a ${_.startCase(gameModeAsShortenedString)} Singleplayer game.`
        : `User ${usernameOfSocketOwner} submitted a score of ${
            finalGameData.currentScore
          } and reached #${globalRank} on a ${_.startCase(
            gameModeAsShortenedString
          )} Singleplayer game.`,
      "info"
    )
  );

  if (globalRank != -1) {
    if (!process.env.CREDENTIAL_SET_USED === "testing") {
      webhook.createAndSendWebhook(
        usernameOfSocketOwner,
        globalRank,
        finalGameData,
        gameModeAsShortenedString
      );
    } else {
      console.log(
        log.addMetadata(
          "Webhook not sent because testing credentials are used.",
          "info"
        )
      );
    }

    socketEventQueue.push({
      eventToPublish: "createToastNotification",
      arguments: {
        position: "topRight",
        message: `User ${usernameOfSocketOwner} submitted a score of ${
          finalGameData.currentScore
        } and reached #${globalRank} on a ${_.startCase(
          gameModeAsShortenedString
        )} Singleplayer game.`
      }
    });
  }

  levelStatus = await checkPlayerLevelStatusForPlayer(
    userIDAsString,
    finalGameData,
    gameMode,
    usernameOfSocketOwner
  );
  // //TODO: socket.emit("levelStatus", levelStatus);
  // if (levelStatus.leveledUp) {
  //     console.log(
  //         log.addMetadata(
  //             `User ${usernameOfSocketOwner} leveled up from Level ${
  //                 levelStatus.currentLevel - 1
  //             } to Level ${levelStatus.currentLevel}`,
  //             "info"
  //         )
  //     );
  // }
  socket.send(
    JSON.stringify({
      action: "updateText",
      arguments: {
        selector: "#experience-points-earned",
        text: Math.floor(
          finalGameData.currentScore /
            (gameModeAsShortenedString === "easy" ? 200 : 100)
        ).toString()
      }
    })
  );
  // console.debug(`${usernameOfSocketOwner} gained ${Math.floor(finalGameData.currentScore / (gameModeAsShortenedString === "easy" ? 200 : 100))}`);
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
  return leveling.giveExperiencePointsToUserID(
    userIDAsString,
    Math.floor(finalGameData.currentScore / divisor)
  );
}

function getCustomSingleplayerRoomInstance(room, player) {
  return room.data.currentGame.players[player].currentGame;
}

function getSocketEventQueue() {
  return socketEventQueue;
}

function formatMultiplayerRoomRanks(ranks) {
  let text = "";
  for (let i = 0; i < ranks[0].length; i++) {
    text =
      `#${ranks[0][i][0][0]} ${
        ranks[0][i][0][1]
      } ${utilities.turnMillisecondsToTime(ranks[0][i][0][2])} ${
        ranks[0][i][0][3]
      } enemies sent` + text;

    text = `<br>` + text;
  }
  return text;
}

module.exports = {
  getSocketEventQueue,
  computeUpdate,
  startDefaultSingleplayerGame,
  submitDefaultSingleplayerGame,
  formatMultiplayerRoomRanks
};
