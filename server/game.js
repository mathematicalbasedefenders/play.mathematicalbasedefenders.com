const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const log = require("./core/log.js");

const _ = require("lodash");

const enemy = require("./game/enemy.js");
const tile = require("./game/tile.js");
const leveling = require("./game/leveling.js");

const mexp = require("math-expression-evaluator");

const TERMS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "-", "*", "/", "=", "a", "b", "c", "d", "n", "x", "y", "z"];
const TERMS_AS_BEAUTIFUL_STRINGS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "\u2013", "×", "÷", "=", "a", "b", "c", "d", "n", "x", "y", "z"];

const FRAMES_PER_SECOND = 60;

const schemas = require("./core/schemas.js");

var roomTypes = {
	SINGLEPLAYER: "singleplayer",
	DEFAULT_MULTIPLAYER: "defaultMultiplayer",
	MULTIPLAYER: "multiplayer",
};

var modes = {
	SINGLEPLAYER: "singleplayer",
	DEFAULT_MULTIPLAYER: "defaultMultiplayer",
	MULTIPLAYER: "multiplayer",
};

const SINGLEPLAYER_GAME_SETTINGS = {
	easyMode: {
		allowedComboTimeInMilliseconds: 10000,
		enemyGenerationThreshold: 0.975,
		enemyGenerationInterval: 50,
		enemySpeedMultiplier: 0.5,
		enemyLimit: 5,
	},
	standardMode: {
		allowedComboTimeInMilliseconds: 5000,
		enemyGenerationThreshold: 0.95,
		enemyGenerationInterval: 50,
		enemySpeedMultiplier: 1,
		enemyLimit: 1000,
	},
};

/**
 * Computes an update.
 * @param {Object} room
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdate(room, deltaTimeInMilliseconds) {
	if (room.type == modes.SINGLEPLAYER) {
		if (room.playing) {
			computeSingleplayerRoomUpdate(room, deltaTimeInMilliseconds);
		}
	} else if (room.type == modes.DEFAULT_MULTIPLAYER) {
		if (room.playing && room.data.currentGame.playersAlive.length > 1) {
			computeMultiplayerRoomUpdate(room, deltaTimeInMilliseconds);
		}
	}
}

/**
 * Computes an update for the specified Singleplayer room and runs other singleplayer room update functions.
 * @param {Object} room
 * @param {number} deltaTimeInMilliseconds
 */
async function computeSingleplayerRoomUpdate(room, deltaTimeInMilliseconds) {
	let framesRendered = (deltaTimeInMilliseconds * FRAMES_PER_SECOND) / 1000;
	// counters
	// general stats
	room.data.currentGame.currentInGameTimeInMilliseconds += deltaTimeInMilliseconds;
	// game stats (not shown)
	room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds += deltaTimeInMilliseconds;
	room.data.currentGame.timeElapsedSinceLastEnemyKillInMilliseconds += deltaTimeInMilliseconds;
	// technical stats
	room.data.currentGame.framesRenderedSinceGameStart += framesRendered;

	// other functions
	computeUpdateForSingleplayerRoomBaseHealth(room, deltaTimeInMilliseconds);
	computeUpdateForSingleplayerRoomCombo(room, deltaTimeInMilliseconds);
	computeUpdateForSingleplayerRoomEnemies(room, deltaTimeInMilliseconds);
	computeUpdateForSingleplayerRoomScoreIndicators(room, deltaTimeInMilliseconds);
	computeUpdateForSingleplayerRoomThingsToRemove(room, deltaTimeInMilliseconds);
}

/**
 * Computes an update for the specified Singleplayer room's base health.
 * @param {Object} room
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdateForSingleplayerRoomBaseHealth(room, deltaTimeInMilliseconds) {
	if (room.data.currentGame.baseHealth <= 0) {
		room.playing = false;
		room.data.currentGame.gameIsOver = true;

		let socketOfGamePlayed = room.host;

		let finalGameData = JSON.parse(JSON.stringify(room.data));

		socketOfGamePlayed.emit("currentGameData", JSON.stringify(finalGameData));
		socketOfGamePlayed.to(room.id).emit("currentGameData", JSON.stringify(finalGameData));

		room.data.currentGame.gameOverScreenShown = true;

		room.host.leave(room.id);
		socketOfGamePlayed.currentRoomSocketIsIn = "";
		submitSingleplayerGame(room.host, finalGameData.currentGame, room.userIDOfHost, room.data.gameMode);
	}
}

/**
 * Computes an update for the specified Singleplayer room's combo.
 * @param {Object} room
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdateForSingleplayerRoomCombo(room, deltaTimeInMilliseconds) {
	let gameMode = room.data.gameMode;
	if (room.data.currentGame.currentCombo > -1 && room.data.currentGame.timeElapsedSinceLastEnemyKillInMilliseconds > SINGLEPLAYER_GAME_SETTINGS[gameMode].allowedComboTimeInMilliseconds) {
		room.data.currentGame.currentCombo = -1;
	}
}

/**
 * Computes an update for the specified Singleplayer room's enemies.
 * @param {Object} room
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdateForSingleplayerRoomEnemies(room, deltaTimeInMilliseconds) {
	let framesRendered = (deltaTimeInMilliseconds * FRAMES_PER_SECOND) / 1000;
	let gameMode = room.data.gameMode;
	// enemy management
	// create
	if (room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds > SINGLEPLAYER_GAME_SETTINGS[gameMode].enemyGenerationInterval) {
		if (Math.random() > SINGLEPLAYER_GAME_SETTINGS[gameMode].enemyGenerationThreshold && room.data.currentGame.enemiesOnField.length < SINGLEPLAYER_GAME_SETTINGS[gameMode].enemyLimit) {
			room.data.currentGame.enemiesOnField[room.data.currentGame.enemiesCreated] = new enemy.Enemy({
				xPosition: 1360,
				yPosition: 120,
				width: 100,
				height: 100,
				requestedValue: generateRandomEnemyTerm(),
				defaultSpeed: SINGLEPLAYER_GAME_SETTINGS[gameMode].enemySpeedMultiplier * (Math.random() * 2 + 1),
				defaultAttack: 1,
				defaultHealth: 1,
				enemyNumber: room.data.currentGame.enemiesCreated + 1,
			});
			room.data.currentGame.enemiesCreated++;
		}
		room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds -= SINGLEPLAYER_GAME_SETTINGS[gameMode].enemyGenerationInterval;
	}
	// move
	for (i = 0; i < room.data.currentGame.enemiesOnField.length; i++) {
		if (room.data.currentGame.enemiesOnField[i] !== undefined) {
			room.data.currentGame.enemiesOnField[i].move(framesRendered * 0.01 * room.data.currentGame.enemiesOnField[i].defaultSpeed);
			if (room.data.currentGame.enemiesOnField[i].sPosition < 0 && !room.data.currentGame.enemiesOnField[i].reachedBase && !room.data.currentGame.enemiesOnField[i].destroyed) {
				room.data.currentGame.enemiesOnField[i].reachedBase = true;
				room.data.currentGame.baseHealth -= 1;
			}
			if (room.data.currentGame.enemiesOnField[i].sPosition < -0.1) {
				room.data.currentGame.enemiesOnField.splice(i, 1);
			}
		}
	}
}

/**
 * Computes an update for the specified Singleplayer Room's score indicators.
 * @param {Object} room
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdateForSingleplayerRoomScoreIndicators(room, deltaTimeInMilliseconds) {
	for (i = 0; i < room.data.currentGame.scoreGainIndicators.length; i++) {
		room.data.currentGame.scoreGainIndicators[i].ageInMilliseconds += deltaTimeInMilliseconds;
		if (room.data.currentGame.scoreGainIndicators[i].ageInMilliseconds >= 500) {
			room.data.currentGame.scoreGainIndicatorsToDestroy.push(room.data.currentGame.scoreGainIndicators[room.data.currentGame.scoreGainIndicators.indexOf(room.data.currentGame.scoreGainIndicators[i])]);
		}
	}
}

/**
 * Computes an update for the specified Singleplayer Room's things to remove.
 * @param {Object} room
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdateForSingleplayerRoomThingsToRemove(room, deltaTimeInMilliseconds) {
	room.data.currentGame.enemiesOnField = room.data.currentGame.enemiesOnField.filter(function (element) {
		return element != null || element !== undefined;
	});
	for (let i = 0; i < room.data.currentGame.scoreGainIndicatorsToDestroy.length; i++) {
		delete room.data.currentGame.scoreGainIndicators[room.data.currentGame.scoreGainIndicatorsToDestroy[i].toString()];
	}
	room.data.currentGame.scoreGainIndicatorsToDestroy = [];
}

/**
 * Computes an update for a multiplayer room.
 * @param {Object} room
 * @param {number} deltaTimeInMilliseconds
 */
async function computeMultiplayerRoomUpdate(room, deltaTimeInMilliseconds) {
	let framesRendered = (deltaTimeInMilliseconds * FRAMES_PER_SECOND) / 1000;
	// counters
	// general stats
	room.data.currentGame.currentInGameTimeInMilliseconds += deltaTimeInMilliseconds;
	// game stats (not shown)
	room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds += deltaTimeInMilliseconds;
	// technical stats
	room.data.currentGame.framesRenderedSinceGameStart += framesRendered;
	// things to apply to all players
	room.data.currentGame.globalEnemyToAdd = null;
	// global enemy
	if (room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds > 50) {
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
				enemyNumber: room.data.currentGame.globalEnemiesCreated + 1,
			});
			room.data.currentGame.globalEnemiesCreated++;
		}
		room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds -= 50;
	}
	loopThroughAndComputeUpdateForEachMultiplayerRoomPlayer(room, deltaTimeInMilliseconds);
}

/**
 * Loops through every player in the multiplayer room and computes an update for each player.
 * @param {*} room
 * @param {*} deltaTimeInMilliseconds
 */
async function loopThroughAndComputeUpdateForEachMultiplayerRoomPlayer(room, deltaTimeInMilliseconds) {
	let playersAliveThisUpdate = room.data.currentGame.playersAlive;
	for (let i = 0; i < playersAliveThisUpdate.length; i++) {
		let player = playersAliveThisUpdate[i];
		computeUpdateForMultiplayerRoomPlayerBaseHealth(room, player, deltaTimeInMilliseconds);
		computeUpdateForMultiplayerRoomPlayerCombo(room, player, deltaTimeInMilliseconds);
		computeUpdateForMultiplayerRoomPlayerEnemies(room, player, deltaTimeInMilliseconds);
		computeUpdateForMultiplayerRoomPlayerThingsToRemove(room, player, deltaTimeInMilliseconds);
		computeUpdateForMultiplayerRoomPlayerScoreIndicators(room, player, deltaTimeInMilliseconds);
	}
}

/**
 * Compute an update for a multiplayer room's player's base health.
 * @param {Object} room
 * @param {*} player
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdateForMultiplayerRoomPlayerBaseHealth(room, player, deltaTimeInMilliseconds) {
	if (room.data.currentGame.players[player].currentGame.baseHealth <= 0) {
		room.data.currentGame.players[player].currentGame.dead = true;
	}
}

/**
 * Computes an update for a multiplayer room's player's combo.
 * @param {Object} room
 * @param {*} player
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdateForMultiplayerRoomPlayerCombo(room, player, deltaTimeInMilliseconds) {
	// combo
	room.data.currentGame.players[player].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds += deltaTimeInMilliseconds;

	if (room.data.currentGame.players[player].currentGame.currentCombo > -1 && room.data.currentGame.players[player].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds > 5000) {
		room.data.currentGame.players[player].currentGame.currentCombo = -1;
	}
}

/**
 * Computes an update for a multiplayer room's player's enemies.
 * @param {Object} room
 * @param {*} player
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdateForMultiplayerRoomPlayerEnemies(room, player, deltaTimeInMilliseconds) {
	// enemy management
	let framesRendered = (deltaTimeInMilliseconds * FRAMES_PER_SECOND) / 1000;
	// create sent
	if (room.data.currentGame.players[player].currentGame.sentEnemiesToSpawn > 0) {
		let nameToPutOnEnemy = room.data.currentGame.players[player].currentGame.enemySenders[0];
		room.data.currentGame.players[player].currentGame.enemySenders.splice(0, 1);
		room.data.currentGame.players[player].currentGame.enemiesOnField[room.data.currentGame.players[player].currentGame.enemiesCreated] = new enemy.Enemy({
			xPosition: 1360,
			yPosition: 120,
			width: 100,
			height: 100,
			requestedValue: generateRandomEnemyTerm(),
			defaultSpeed: Math.random() * 2 + 1,
			defaultAttack: 1,
			defaultHealth: 1,
			enemyNumber: "s" + room.data.currentGame.players[player].currentGame.enemiesCreated + 1,
			senderName: nameToPutOnEnemy,
		});
		room.data.currentGame.players[player].currentGame.enemiesCreated++;
		room.data.currentGame.players[player].currentGame.sentEnemiesToSpawn--;
	}

	// create global if there is one
	if (room.data.currentGame.globalEnemyToAdd != null) {
		room.data.currentGame.players[player].currentGame.enemiesOnField[room.data.currentGame.players[player].currentGame.enemiesCreated] = _.cloneDeep(room.data.currentGame.globalEnemyToAdd);
		room.data.currentGame.players[player].currentGame.enemiesCreated++;
	}
	for (j = 0; j < room.data.currentGame.players[player].currentGame.enemiesOnField.length; j++) {
		if (room.data.currentGame.players[player].currentGame.enemiesOnField[j] !== undefined) {
			room.data.currentGame.players[player].currentGame.enemiesOnField[j].move(framesRendered * 0.01 * room.data.currentGame.players[player].currentGame.enemiesOnField[j].defaultSpeed);
			if (
				room.data.currentGame.players[player].currentGame.enemiesOnField[j].sPosition < 0 &&
				!room.data.currentGame.players[player].currentGame.enemiesOnField[j].reachedBase &&
				!room.data.currentGame.players[player].currentGame.enemiesOnField[j].destroyed
			) {
				room.data.currentGame.players[player].currentGame.enemiesOnField[j].reachedBase = true;
				room.data.currentGame.players[player].currentGame.baseHealth -= 1;
			}
			if (room.data.currentGame.players[player].currentGame.enemiesOnField[j].sPosition < -0.5) {
				room.data.currentGame.players[player].currentGame.enemiesOnField.splice(j, 1);
			}
		}
	}
}

/**
 * Computes an update for a multiplayer room's player's score indicators.
 * @param {Object} room
 * @param {*} player
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdateForMultiplayerRoomPlayerScoreIndicators(room, player, deltaTimeInMilliseconds) {
	for (j = 0; j < room.data.currentGame.players[player].currentGame.enemiesSentIndicators.length; j++) {
		room.data.currentGame.players[player].currentGame.enemiesSentIndicators[j].ageInMilliseconds += deltaTimeInMilliseconds;
		if (room.data.currentGame.players[player].currentGame.enemiesSentIndicators[j].ageInMilliseconds >= 500) {
			room.data.currentGame.players[player].currentGame.enemiesSentIndicatorsToDestroy.push(
				room.data.currentGame.players[player].currentGame.enemiesSentIndicators[room.data.currentGame.players[player].currentGame.enemiesSentIndicators.indexOf(room.data.currentGame.players[player].currentGame.enemiesSentIndicators[j])]
			);
		}
	}
}

/**
 * Computes an update for a multiplayer room's player's things to remove.
 * @param {Object} room
 * @param {*} player
 * @param {number} deltaTimeInMilliseconds
 */
async function computeUpdateForMultiplayerRoomPlayerThingsToRemove(room, player, deltaTimeInMilliseconds) {
	for (let i = 0; i < room.data.currentGame.players[player].currentGame.enemiesSentIndicatorsToDestroy.length; i++) {
		delete room.data.currentGame.players[player].currentGame.enemiesSentIndicators[room.data.currentGame.players[player].currentGame.enemiesSentIndicatorsToDestroy[i].toString()];
	}
	room.data.currentGame.players[player].currentGame.enemiesSentIndicatorsToDestroy = [];

	room.data.currentGame.players[player].currentGame.enemiesOnField = room.data.currentGame.players[player].currentGame.enemiesOnField.filter(function (element) {
		return element != null || element !== undefined;
	});
}

function createNewSingleplayerGameData(mode, roomID, gameMode) {
	switch (mode) {
		case modes.SINGLEPLAYER: {
			let data = {
				id: roomID,

				mode: mode,
				gameMode: gameMode,

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
					bagQuantities: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2],
					availableTermsIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],

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
				},
			};
			return data;
		}
	}
}

function createNewDefaultMultiplayerGameData(roomID, socket) {
	let data = {
		id: roomID,
		mode: modes.DEFAULT_MULTIPLAYER,
		currentGame: {
			players: {
				[socket.id]: {
					playerName: socket.loggedIn ? socket.usernameOfSocketOwner : socket.guestNameOfSocketOwner,

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
					bagQuantities: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2],
					availableTermsIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],

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
					experiencePointsEarned: 0,
				},
			},
		},
	};
	return data;
}

function createNewDefaultMultiplayerRoomPlayerObject(socket) {
	let data = {
		playerName: socket.loggedIn ? socket.usernameOfSocketOwner : socket.guestNameOfSocketOwner,
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
		bagQuantities: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2],
		availableTermsIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],

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
		gameOverScreenShown: false,
	};
	return data;
}

function startSingleplayerGame(roomID) {}

/**
 * Submits a singleplayer game.
 * @param {*} socket
 * @param {*} finalGameData
 * @param {*} userIDOfSocketOwner
 * @param {*} gameMode
 * @returns
 */
async function submitSingleplayerGame(socket, finalGameData, userIDOfSocketOwner, gameMode) {
	// determine mode
	let gameModeAsShortenedString = "";
	if (gameMode == "easyMode") {
		gameModeAsShortenedString = "easy";
	} else if (gameMode == "standardMode") {
		gameModeAsShortenedString = "standard";
	} else {
		console.error(log.addMetadata(`${gameMode} is not a valid Singleplayer game mode!`, "error"));
		return;
	}
	// check #1
	if (userIDOfSocketOwner === undefined) {
		console.log(log.addMetadata(`A guest user has submitted a score of ${finalGameData.currentScore} on a ${_.startCase(gameModeAsShortenedString)} Singleplayer game.`, "info"));
		socket.emit("finalRanks", false, false, false);
		return;
	}

	let userIDAsString = userIDOfSocketOwner.toString();
	let usernameOfSocketOwner = JSON.parse(JSON.stringify(await schemas.getUserModel().findById(userIDAsString))).username;
	let personalBestBroken = false;
	let playerDataOfSocketOwner = await schemas.getUserModel().findById(userIDAsString);
	let globalRank = -1;
	let levelStatus = {};

	personalBestBroken = await checkSingleplayerPersonalBestForPlayer(userIDAsString, finalGameData, gameMode, usernameOfSocketOwner);
	globalRank = await checkAndModifyLeaderboards(userIDAsString, finalGameData, gameMode, usernameOfSocketOwner);

	socket.emit("finalRanks", personalBestBroken, globalRank, true);

	console.log(
		log.addMetadata(
			globalRank == -1
				? `User ${usernameOfSocketOwner} submitted a score of ${finalGameData.finalScore} on a ${_.startCase(gameModeAsShortenedString)} Singleplayer game.`
				: `User ${usernameOfSocketOwner} submitted a score of ${finalGameData.finalScore} and reached #${globalRank} on a ${_.startCase(gameModeAsShortenedString)} Singleplayer game.`,
			"info"
		)
	);

	levelStatus = await checkPlayerLevelStatusForPlayer(userIDAsString, finalGameData, gameMode, usernameOfSocketOwner);
	socket.emit("levelStatus", levelStatus);
	if (levelStatus.leveledUp) {
		console.log(log.addMetadata(`User ${usernameOfSocketOwner} leveled up from Level ${levelStatus.currentLevel - 1} to Level ${levelStatus.currentLevel}`, "info"));
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
async function checkSingleplayerPersonalBestForPlayer(userIDAsString, finalGameData, gameMode, usernameOfSocketOwner) {
	let personalBestBroken = false;
	let finalScore = finalGameData.currentScore;
	let fieldToUpdate;
	let fullPathOfFieldToUpdate;

	if (gameMode == "easyMode") {
		fieldToUpdate = "easyModePersonalBestScore";
	} else if (gameMode == "standardMode") {
		fieldToUpdate = "standardModePersonalBestScore";
	} else {
		console.error(log.addMetadata(`${gameMode} is not a valid Singleplayer game mode!`, "error"));
		return;
	}

	if (playerDataOfSocketOwner["statistics"][fieldToUpdate] === undefined) {
		// personal best field doesn't exist
		// so create one, and assign the score to the field
		await schemas.getUserModel().findByIdAndUpdate(userIDAsString, { $set: { [`statistics.${fieldToUpdate}`]: finalScore } }, { upsert: true }, (error3, result3) => {
			if (error3) {
				// console.log(log.addMetadata("ERROR from Socket " + socket.id + " (" + usernameOfSocketOwner + "): ", "info"));
				console.error(log.addMetadata(error3, "error"));
			}
			return result3;
		});
		personalBestBroken = true;
	} else {
		// personal best field exists
		if (finalScore > playerDataOfSocketOwner["statistics"][fieldToUpdate]) {
			// score is higher than personal best
			await schemas.getUserModel().findByIdAndUpdate(userIDAsString, { $set: { [`statistics.${fieldToUpdate}`]: finalScore } }, { upsert: true }, (error4, result4) => {
				if (error4) {
					console.error(log.addMetadata(error4, "error"));
				}
				return result4;
			});
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
async function checkAndModifyLeaderboards(userIDAsString, finalGameData, gameMode, usernameOfSocketOwner) {
	var placePlayerRanked = -1;
	var placePlayerRankedBefore = -1;
	let leaderboardsModel;
	let score = finalGameData.score;

	if (gameMode == "easyMode") {
		leaderboardsModel = schemas.getEasyModeLeaderboardsModel();
	} else if (gameMode == "standardMode") {
		leaderboardsModel = schemas.getStandardModeLeaderboardsModel();
	} else {
		console.error(log.addMetadata(`${gameMode} is not a valid Singleplayer game mode!`, "error"));
		return;
	}
	// main check #1
	for (var i = 1; i <= 50; i++) {
		var data = await leaderboardsModel.find({ rankNumber: i }, function (error2, result2) {
			if (error2) {
				console.error(log.addMetadata(error2.stack, "error"));
			}
			return result2;
		});
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
		var data = await leaderboardsModel.find({ rankNumber: i }, function (error2, result2) {
			if (error2) {
				console.error(log.addMetadata(error2.stack, "error"));
			}
			return result2;
		});
		if (userIDAsString == data[0].userIDOfHolder) {
			return placePlayerRanked;
		}
	}
	// middle check #1
	// check if player is already on leaderboard but at a lower rank
	for (var i = placePlayerRanked; i <= 50; i++) {
		var data = await leaderboardsModel.find({ rankNumber: i }, function (error2, result2) {
			if (error2) {
				console.error(log.addMetadata(error2.stack, "error"));
			}
			return result2;
		});
		if (userIDAsString == data[0].userIDOfHolder) {
			placePlayerRankedBefore = i;
			break;
		}
	}

	if (placePlayerRankedBefore != -1) {
		for (var i = placePlayerRankedBefore; i < 50; i++) {
			var data1 = await leaderboardsModel.findOne({ rankNumber: i + 1 });
			await leaderboardsModel.findOneAndUpdate({ rankNumber: i }, { userIDOfHolder: data1.userIDOfHolder, score: data1.score }, function (error4, result4) {
				if (error4) {
					console.error(log.addMetadata(error4.stack, "error"));
				}
				return result4;
			});
		}
	}
	// modify
	for (var i = 50; i >= placePlayerRanked; i--) {
		if (i != 1) {
			var data1 = await leaderboardsModel.findOne({ rankNumber: i - 1 });
			await leaderboardsModel.findOneAndUpdate({ rankNumber: i }, { userIDOfHolder: data1.userIDOfHolder, score: data1.score }, function (error4, result4) {
				if (error4) {
					console.error(log.addMetadata(error4.stack, "error"));
				}
				return result4;
			});
		}
	}

	await leaderboardsModel.findOneAndUpdate({ rankNumber: placePlayerRanked }, { userIDOfHolder: userIDAsString, score: score }, function (error5, result5) {
		if (error5) {
			console.error(log.addMetadata(error5.stack, "error"));
		}
		return result5;
	});
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
async function checkPlayerLevelStatusForPlayer(userIDAsString, finalGameData, gameMode, usernameOfSocketOwner) {
	let finalScore = finalGameData.score;
	let divisor = gameMode == "easyMode" ? 200 : 100;
	return leveling.giveExperiencePointsToPlayerID(userIDAsString, Math.floor(finalScore / divisor));
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
		case "defaultMultiplayer": {
			if (evaluateProblem(room, socket)) {
			} else {
				room.data.currentGame.players[socket.id].currentGame.sentEnemiesToSpawn += room.data.currentGame.players[socket.id].currentGame.enemiesPending;
				room.data.currentGame.players[socket.id].currentGame.enemiesPending = 0;
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
	switch (room.type) {
		case "singleplayer": {
			if (socket.socketIsHostOfRoomItIsIn) {
				// get number of equal signs
				switch ((room.data.currentGame.currentProblemAsText.match("=") || []).length) {
					case 0: {
						let originalProblem = room.data.currentGame.currentProblemAsText;
						let problemToEvaluate = fixProblem(originalProblem);
						let result = calculateProblem(problemToEvaluate, room, socket);
						let hasResults = evaluateSingleplayerRoomProblemResult(result, room);
						return hasResults;
					}
					case 1: {
						let originalProblem = room.data.currentGame.currentProblemAsText;
						let problemToEvaluate = fixProblem(originalProblem);
						let problemOnLeftSide = problemToEvaluate.substring(0, problemToEvaluate.indexOf("="));
						let problemOnRightSide = problemToEvaluate.substring(problemToEvaluate.indexOf("=") + 1);
						let valid = assignValueToSingleplayerRoomVariable(problemOnLeftSide, problemOnRightSide, room);
						return valid;
					}
					default: {
						return false;
					}
				}
			}
		}
		case "defaultMultiplayer": {
			switch ((room.data.currentGame.players[socket.id].currentGame.currentProblemAsText.match("=") || []).length) {
				case 0: {
					let originalProblem = room.data.currentGame.players[socket.id].currentGame.currentProblemAsText;
					let problemToEvaluate = fixProblem(originalProblem);
					let result = calculateProblem(problemToEvaluate, room, socket);
					let hasResults = evaluateMultiplayerRoomProblemResult(result, room, socket);
					return hasResults;
				}
				case 1: {
					let valid = false;
					let originalProblem = room.data.currentGame.players[socket.id].currentGame.currentProblemAsText;
					let problemToEvaluate = fixProblem(originalProblem);
					let problemOnLeftSide = problemToEvaluate.substring(0, problemToEvaluate.indexOf("="));
					let problemOnRightSide = problemToEvaluate.substring(problemToEvaluate.indexOf("=") + 1);
					valid = assignValueToMultiplayerRoomVariable(problemOnLeftSide, problemOnRightSide, room, socket);
					return valid;
				}
				default: {
					return false;
				}
			}
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
 * <========= SINGLEPLAYER ROOM FUNCTIONS =========>
 */

/**
 * Evaluates a sent problem in a Singleplayer room.
 * @param {*} result 
 * @param {*} room 
 * @returns 
 */
function evaluateSingleplayerRoomProblemResult(result, room) {
	let hasAnswers = false;
	let requestedValues = [];
	let answers = 0;
	let enemiesToKill = [];
	let originalProblem = room.data.currentGame.currentProblemAsText;
	if (result) {
		// evaluate calculated string
		for (i = 0; i < room.data.currentGame.enemiesOnField.length; i++) {
			requestedValues.push(room.data.currentGame.enemiesOnField[i] === undefined && room.data.currentGame.enemiesOnField[i].sPosition < 0 ? undefined : room.data.currentGame.enemiesOnField[i].requestedValue);
		}
		for (i = 0; i < requestedValues.length; i++) {
			if (result == calculateProblem(requestedValues[i], room) || (requestedValues[i] !== undefined ? originalProblem.toString() == requestedValues[i].toString() : false)) {
				answers++;
				enemiesToKill.push(room.data.currentGame.enemiesOnField[i]);
			}
		}
		if (answers > 0 && result !== undefined) {
			killSingleplayerRoomEnemies(enemiesToKill, room);
			replaceSingleplayerRoomTiles(room);
			enemiesToKill = [];
			hasAnswers = true;
		}
		return hasAnswers;
	} else {
		// evaluate RAW result (i.e. the problem string itself)
		for (i = 0; i < room.data.currentGame.enemiesOnField.length; i++) {
			requestedValues.push(room.data.currentGame.enemiesOnField[i] === undefined && room.data.currentGame.enemiesOnField[i].sPosition < 0 ? undefined : room.data.currentGame.enemiesOnField[i].requestedValue);
		}

		for (i = 0; i < requestedValues.length; i++) {
			if (result == calculateProblem(requestedValues[i], room) || (requestedValues[i] !== undefined ? originalProblem.toString() == requestedValues[i].toString() : false)) {
				answers++;
				enemiesToKill.push(room.data.currentGame.enemiesOnField[i]);
			}
		}
		if (answers > 0 && result !== undefined) {
			killSingleplayerRoomEnemies(enemiesToKill, room);
			replaceSingleplayerRoomTiles(room);
			enemiesToKill = [];
			hasAnswers = true;
		}
		return hasAnswers;
	}
}

/**
 * Kills all kill-able Singleplayer Room enemies.
 * @param {*} enemiesToKill 
 * @param {*} room 
 */
function killSingleplayerRoomEnemies(enemiesToKill, room) {
	for (i = 0; i < enemiesToKill.length; i++) {
		// Reset counter
		room.data.currentGame.framesElapsedSinceLastEnemyKill = 0;
		room.data.currentGame.timeElapsedSinceLastEnemyKillInMilliseconds = 0;

		room.data.currentGame.currentCombo++;

		room.data.currentGame.currentScore += Math.round(
			100 * calculateProblemLengthMultiplier(room.data.currentGame.currentProblemAsText.length) * calculateComboMultiplier(room.data.currentGame.currentCombo) * calculateEnemyPositionMultiplier(enemiesToKill[i].sPosition)
		);

		room.data.currentGame.scoreGainIndicators.push({
			number: room.data.currentGame.enemiesKilled + 1,
			sPosition: enemiesToKill[i].sPosition,
			content:
				"+" +
				Math.round(
					100 * calculateProblemLengthMultiplier(room.data.currentGame.currentProblemAsText.length) * calculateComboMultiplier(room.data.currentGame.currentCombo) * calculateEnemyPositionMultiplier(enemiesToKill[i].sPosition)
				).toString(),
			ageInMilliseconds: 0,
		});

		room.data.currentGame.enemiesOnField[room.data.currentGame.enemiesOnField.indexOf(enemiesToKill[i])].toDestroy = true;

		room.data.currentGame.enemiesKilled++;
	}
}

/**
 * Assigns a value to a Singleplayer room variable.
 * @param {*} problemOnLeftSide 
 * @param {*} problemOnRightSide 
 * @param {*} room 
 * @returns 
 */
function assignValueToSingleplayerRoomVariable(problemOnLeftSide, problemOnRightSide, room) {
	if (problemOnLeftSide.match(/[a-d]/) != null && calculateProblem(problemOnRightSide, room) != null) {
		switch (problemOnLeftSide) {
			case "a": {
				room.data.currentGame.valueOfVariableA = calculateProblem(problemOnRightSide, room);
				break;
			}
			case "b": {
				room.data.currentGame.valueOfVariableB = calculateProblem(problemOnRightSide, room);
				break;
			}
			case "c": {
				room.data.currentGame.valueOfVariableC = calculateProblem(problemOnRightSide, room);
				break;
			}
			case "d": {
				room.data.currentGame.valueOfVariableD = calculateProblem(problemOnRightSide, room);
				break;
			}
		}
		replaceSingleplayerRoomTiles(room);
		return true;
	}
	return false;
}

/**
 * Replaces tiles in a Singleplayer room.
 * @param {*} room 
 */
function replaceSingleplayerRoomTiles(room) {
	for (i = 0; i < room.data.currentGame.tilesInCurrentProblem.length; i++) {
		let t = new tile.Tile(generateRandomTileTermID(room), i, false, room.data.currentGame.tilesCreated + 1);
		room.data.currentGame.tilesCreated++;
		room.data.currentGame.tilesOnBoard[room.data.currentGame.tilesInCurrentProblem[i]] = t;
	}

	room.data.currentGame.currentProblemAsText = "";
	room.data.currentGame.currentProblemAsBeautifulText = "";
	room.data.currentGame.tilesInCurrentProblem = [];
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
function evaluateMultiplayerRoomProblemResult(result, room, socket) {
	let hasAnswers = false;
	let requestedValues = [];
	let answers = 0;
	let enemiesToKill = [];
	let originalProblem = room.data.currentGame.players[socket.id].currentGame.currentProblemAsText;
	if (result) {
		// evaluate calculated string
		for (i = 0; i < room.data.currentGame.players[socket.id].currentGame.enemiesOnField.length; i++) {
			requestedValues.push(
				room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i] === undefined && room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i].sPosition < 0
					? undefined
					: room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i].requestedValue
			);
		}
		for (i = 0; i < requestedValues.length; i++) {
			if (result == calculateProblem(requestedValues[i], room, socket) || (requestedValues[i] !== undefined ? originalProblem.toString() == requestedValues[i].toString() : false)) {
				answers++;
				enemiesToKill.push(room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i]);
			}
		}
		if (answers > 0 && result !== undefined) {
			killMultiplayerRoomEnemies(enemiesToKill, room, socket);
			replaceMultiplayerRoomTiles(room, socket);
			enemiesToKill = [];
			hasAnswers = true;
		}
		return hasAnswers;
	} else {
		// evaluate RAW result (i.e. the problem string itself)
		for (i = 0; i < room.data.currentGame.players[socket.id].currentGame.enemiesOnField.length; i++) {
			requestedValues.push(
				room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i] === undefined && room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i].sPosition < 0
					? undefined
					: room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i].requestedValue
			);
		}

		for (i = 0; i < requestedValues.length; i++) {
			if (result == calculateProblem(requestedValues[i], room, socket) || (requestedValues[i] !== undefined ? originalProblem.toString() == requestedValues[i].toString() : false)) {
				answers++;
				enemiesToKill.push(room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i]);
			}
		}
		if (answers > 0 && result !== undefined) {
			killMultiplayerRoomEnemies(enemiesToKill, room, socket);
			replaceMultiplayerRoomTiles(room, socket);
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
function killMultiplayerRoomEnemies(enemiesToKill, room, socket) {
	for (i = 0; i < enemiesToKill.length; i++) {
		// Reset counter
		room.data.currentGame.players[socket.id].currentGame.framesElapsedSinceLastEnemyKill = 0;
		room.data.currentGame.players[socket.id].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds = 0;

		room.data.currentGame.players[socket.id].currentGame.currentCombo++;

		let enemiesSent = Math.floor(
			((room.data.currentGame.players[socket.id].currentGame.currentProblemAsText.length - 3) / 1.05 + (room.data.currentGame.players[socket.id].currentGame.currentCombo - 2) + (enemiesToKill[i].sPosition - 5) / 1.25 + 2) / 1.25
		);

		room.data.currentGame.players[socket.id].currentGame.enemiesSent += Math.max(0, enemiesSent);

		let playerToSendEnemiesTo = _.sample(room.data.currentGame.players);
		while (playerToSendEnemiesTo.currentGame.connectionID == socket.id) {
			playerToSendEnemiesTo = _.sample(room.data.currentGame.players);
		}

		room.data.currentGame.players[socket.id].currentGame.enemiesSentIndicators.push({
			number: room.data.currentGame.players[socket.id].currentGame.enemiesKilled + 1,
			sPosition: enemiesToKill[i].sPosition,
			content: Math.max(0, enemiesSent).toString(),
			ageInMilliseconds: 0,
		});

		while (enemiesSent > 0) {
			if (room.data.currentGame.players[socket.id].currentGame.enemiesPending <= 0) {
				room.data.currentGame.players[playerToSendEnemiesTo.currentGame.connectionID].currentGame.enemiesPending += 1;
				room.data.currentGame.players[playerToSendEnemiesTo.currentGame.connectionID].currentGame.enemySenders.push(room.data.currentGame.players[socket.id].currentGame.playerName);
			} else {
				room.data.currentGame.players[socket.id].currentGame.enemiesPending -= 1;
			}
			enemiesSent--;
		}

		room.data.currentGame.players[socket.id].currentGame.enemiesOnField[room.data.currentGame.players[socket.id].currentGame.enemiesOnField.indexOf(enemiesToKill[i])].toDestroy = true;

		room.data.currentGame.players[socket.id].currentGame.enemiesKilled++;
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
function assignValueToMultiplayerRoomVariable(problemOnLeftSide, problemOnRightSide, room, socket) {
	if (problemOnLeftSide.match(/[a-d]/) != null && calculateProblem(problemOnRightSide, room) != null) {
		switch (problemOnLeftSide) {
			case "a": {
				room.data.currentGame.players[socket.id].currentGame.valueOfVariableA = calculateProblem(problemOnRightSide, room);
				break;
			}
			case "b": {
				room.data.currentGame.players[socket.id].currentGame.valueOfVariableB = calculateProblem(problemOnRightSide, room);
				break;
			}
			case "c": {
				room.data.currentGame.players[socket.id].currentGame.valueOfVariableC = calculateProblem(problemOnRightSide, room);
				break;
			}
			case "d": {
				room.data.currentGame.players[socket.id].currentGame.valueOfVariableD = calculateProblem(problemOnRightSide, room);
				break;
			}
		}
		replaceMultiplayerRoomTiles(room);
		return true;
	}
	return false;
}


/**
 * Replaces tiles for a player in a Multiplayer Room.
 * @param {*} room 
 * @param {*} socket 
 */
function replaceMultiplayerRoomTiles(room, socket) {
	for (i = 0; i < room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem.length; i++) {
		let t = new tile.Tile(getMultiplayerTileQueueOfPlayer(room, socket), i, false, room.data.currentGame.players[socket.id].currentGame.tilesCreated + 1);
		room.data.currentGame.players[socket.id].currentGame.tilesCreated++;
		room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem[i]] = t;
	}

	room.data.currentGame.players[socket.id].currentGame.currentProblemAsText = "";
	room.data.currentGame.players[socket.id].currentGame.currentProblemAsBeautifulText = "";
	room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem = [];
}

/**
 * Generates a tile ID for a Singleplayer room.
 * @param {*} room 
 * @returns 
 */
function generateRandomTileTermID(room) {
	let roll = room.data.currentGame.availableTermsIndexes[Math.floor(Math.random() * room.data.currentGame.availableTermsIndexes.length)];
	let toReturn = roll;
	room.data.currentGame.bagQuantities[roll]--;
	if (room.data.currentGame.bagQuantities[roll] <= 0) {
		room.data.currentGame.availableTermsIndexes.splice(room.data.currentGame.availableTermsIndexes.indexOf(roll), 1);
		if (room.data.currentGame.availableTermsIndexes.length <= 0) {
			room.data.currentGame.bagQuantities = [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2];
			room.data.currentGame.availableTermsIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
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
	if (room.type == "singleplayer") {
		try {
			return mexp.eval(
				problem,
				[
					{ type: 3, token: "a", show: "a", value: "a" },
					{ type: 3, token: "b", show: "b", value: "b" },
					{ type: 3, token: "c", show: "c", value: "c" },
					{ type: 3, token: "d", show: "d", value: "d" },
				],
				{ a: room.data.currentGame.valueOfVariableA, b: room.data.currentGame.valueOfVariableB, c: room.data.currentGame.valueOfVariableC, d: room.data.currentGame.valueOfVariableD }
			);
		} catch (error) {
			return null;
		}
	} else {
		try {
			return mexp.eval(
				problem,
				[
					{ type: 3, token: "a", show: "a", value: "a" },
					{ type: 3, token: "b", show: "b", value: "b" },
					{ type: 3, token: "c", show: "c", value: "c" },
					{ type: 3, token: "d", show: "d", value: "d" },
				],
				{
					a: room.data.currentGame.players[socket.id].currentGame.valueOfVariableA,
					b: room.data.currentGame.players[socket.id].currentGame.valueOfVariableB,
					c: room.data.currentGame.players[socket.id].currentGame.valueOfVariableC,
					d: room.data.currentGame.players[socket.id].currentGame.valueOfVariableD,
				}
			);
		} catch (error) {
			return null;
		}
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
	return Math.pow(1.1, Math.min(Math.max(combo, 0), 5000));
}

function convertTermIDToTerm(id) {
	return TERMS[id];
}

function convertTermIDToBeautifulString(id) {
	return TERMS_AS_BEAUTIFUL_STRINGS[id];
}

function generateMultiplayerTileQueue() {
	let bagQuantities = [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2];
	let availableTermsIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
	let queue = [];

	for (let i = 0; i < 49; i++) {
		let roll = availableTermsIndexes[Math.floor(Math.random() * availableTermsIndexes.length)];

		queue.push(roll);
		bagQuantities[roll]--;
		if (bagQuantities[roll] <= 0) {
			availableTermsIndexes.splice(availableTermsIndexes.indexOf(roll), 1);
			if (availableTermsIndexes.length <= 0) {
				bagQuantities = [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2];
				availableTermsIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
			}
		}
	}

	return queue;
}

function getMultiplayerTileQueueOfPlayer(room, socket) {
	if (room.data.currentGame.players[socket.id].currentGame.tileQueue[room.data.currentGame.players[socket.id].currentGame.currentTileQueue].length == 0) {
		room.data.currentGame.players[socket.id].currentGame.currentTileQueue++;
		if (room.data.currentGame.globalTileQueues.length < room.data.currentGame.players[socket.id].currentGame.currentTileQueue) {
			room.data.currentGame.globalTileQueue.push(generateMultiplayerTileQueue());
			room.data.currentGame.players[socket.id].currentGame.tileQueue.push(room.data.currentGame.players[socket.id].currentGame.currentTileQueue);
		}
	}
	let tile = room.data.currentGame.players[socket.id].currentGame.tileQueue[room.data.currentGame.players[socket.id].currentGame.currentTileQueue][0];

	room.data.currentGame.players[socket.id].currentGame.tileQueue[room.data.currentGame.players[socket.id].currentGame.currentTileQueue].shift();
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
			return ["Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9", "NumpadAdd", "NumpadSubtract", "NumpadMultiply", "NumpadDivide", "NumpadEnter"].indexOf(keyPressed);
		} else {
			return playerKeybinds.indexOf(keyPressed);
		}
	}
}

function deleteLastSelectedTerm(room, socket) {
	switch (room.type) {
		case modes.SINGLEPLAYER: {
			if (room.data.currentGame.tilesInCurrentProblem.length > 0) {
				processTileClick(room.data.currentGame.tilesInCurrentProblem[room.data.currentGame.tilesInCurrentProblem.length - 1], room, socket);
			}
			break;
		}
		case modes.DEFAULT_MULTIPLAYER: {
			if (room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem.length > 0) {
				processTileClick(room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem[room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem.length - 1], room, socket);
			}
		}
	}
}

function forceSelectTileWithTermID(termIDToSelect, room, socket) {
	if (room.type == modes.SINGLEPLAYER) {
		for (i = 0; i < 49; i++) {
			if (room.data.currentGame.tilesOnBoard[i].termID == termIDToSelect && room.data.currentGame.tilesOnBoard[i].selected == false) {
				processTileClick(i, room, socket);
				return; // break
			}
		}

		// None found
	} else if (room.type == modes.DEFAULT_MULTIPLAYER) {
		for (i = 0; i < 49; i++) {
			if (room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[i].termID == termIDToSelect && room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[i].selected == false) {
				processTileClick(i, room, socket);
				return; // break
			}
		}
	}
}

function processTileClick(slot, room, socket) {
	if (socket.currentRoomSocketIsIn != "") {
		if (room.type == modes.SINGLEPLAYER && socket.socketIsHostOfRoomItIsIn) {
			// socket is ignored here
			room.data.currentGame.actionsPerformed++;
			room.data.currentGame.tilesOnBoard[slot].selected = !room.data.currentGame.tilesOnBoard[slot].selected;
			if (room.data.currentGame.tilesOnBoard[slot].selected) {
				room.data.currentGame.tilesInCurrentProblem.push(slot);
				room.data.currentGame.currentProblemAsText += convertTermIDToTerm(room.data.currentGame.tilesOnBoard[slot].termID);
				room.data.currentGame.currentProblemAsBeautifulText += convertTermIDToBeautifulString(room.data.currentGame.tilesOnBoard[slot].termID);
			} else {
				let index = room.data.currentGame.tilesInCurrentProblem.indexOf(slot);
				room.data.currentGame.tilesInCurrentProblem.splice(index, 1);
				let temp = room.data.currentGame.currentProblemAsText.split("");
				temp.splice(index, 1);
				room.data.currentGame.currentProblemAsText = temp.join("");
				let temp2 = room.data.currentGame.currentProblemAsBeautifulText.split("");
				temp2.splice(index, 1);
				room.data.currentGame.currentProblemAsBeautifulText = temp2.join("");
			}
		} else if (room.type == modes.DEFAULT_MULTIPLAYER) {
			room.data.currentGame.players[socket.id].currentGame.actionsPerformed++;
			room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[slot].selected = !room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[slot].selected;
			if (room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[slot].selected) {
				room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem.push(slot);
				room.data.currentGame.players[socket.id].currentGame.currentProblemAsText += convertTermIDToTerm(room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[slot].termID);
				room.data.currentGame.players[socket.id].currentGame.currentProblemAsBeautifulText += convertTermIDToBeautifulString(room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[slot].termID);
			} else {
				let index = room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem.indexOf(slot);
				room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem.splice(index, 1);
				let temp = room.data.currentGame.players[socket.id].currentGame.currentProblemAsText.split("");
				temp.splice(index, 1);
				room.data.currentGame.players[socket.id].currentGame.currentProblemAsText = temp.join("");
				let temp2 = room.data.currentGame.players[socket.id].currentGame.currentProblemAsBeautifulText.split("");
				temp2.splice(index, 1);
				room.data.currentGame.players[socket.id].currentGame.currentProblemAsBeautifulText = temp2.join("");
			}
		}
	}
}

function generateRandomEnemyTerm() {
	let roll = Math.random();
	if (roll < 0.9) {
		return (Math.random() >= 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000);
	} else if (roll < 0.925) {
		return (Math.random() >= 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000) + "a";
	} else if (roll < 0.95) {
		return (Math.random() >= 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000) + "b";
	} else if (roll < 0.975) {
		return (Math.random() >= 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000) + "c";
	} else {
		return (Math.random() >= 0.5 ? -1 : 1) * Math.floor(Math.random() * 1000) + "d";
	}
}

module.exports = {
	// major
	computeUpdate,
	createNewSingleplayerGameData,
	createNewDefaultMultiplayerGameData,
	startSingleplayerGame,
	submitSingleplayerGame,

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
	createNewDefaultMultiplayerRoomPlayerObject,
	generateMultiplayerTileQueue,
};
