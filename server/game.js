const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const log = require("./core/log.js");

const _ = require("lodash");

const enemy = require("./game/enemy.js");
const tile = require("./game/tile.js");
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

// MAJOR
async function computeUpdate(room, deltaTimeInMilliseconds) {
	// other stats

	// rooms
	if (room.type == modes.SINGLEPLAYER) {
		if (room.playing) {
			// variables
			var framesRendered = (deltaTimeInMilliseconds * FRAMES_PER_SECOND) / 1000;

			// counters
			// general stats
			room.data.currentGame.currentInGameTimeInMilliseconds += deltaTimeInMilliseconds;
			// game stats (not shown)
			room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds += deltaTimeInMilliseconds;
			room.data.currentGame.timeElapsedSinceLastEnemyKillInMilliseconds += deltaTimeInMilliseconds;

			// technical stats
			room.data.currentGame.framesRenderedSinceGameStart += framesRendered;

			// base health
			if (room.data.currentGame.baseHealth <= 0) {
				room.playing = false;
				room.data.currentGame.gameIsOver = true;

				let socketOfGamePlayed = room.host;

				let finalGameData = JSON.parse(JSON.stringify(room.data));

				socketOfGamePlayed.emit("currentGameData", JSON.stringify(finalGameData))
				socketOfGamePlayed.to(room.id).emit("currentGameData", JSON.stringify(finalGameData))

				room.data.currentGame.gameOverScreenShown = true;

				room.host.leave(room.id);
				socketOfGamePlayed.currentRoomSocketIsIn = "";
				submitSingleplayerGame(room.host, finalGameData.currentGame, room.userIDOfHost);
			}

			// combo
			if (room.data.currentGame.currentCombo > -1 && room.data.currentGame.timeElapsedSinceLastEnemyKillInMilliseconds > 5000) {
				room.data.currentGame.currentCombo = -1;
			}

			// enemy management
			// create
			if (room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds > 50) {
				if (Math.random() > 0.95) {
					room.data.currentGame.enemiesOnField[room.data.currentGame.enemiesCreated] = new enemy.Enemy(1360, 120, 100, 100, generateRandomEnemyTerm(), Math.random() * 2 + 1, 1, 1, room.data.currentGame.enemiesCreated + 1);
					room.data.currentGame.enemiesCreated++;
				}
				room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds -= 50;
			}
			// move
			for (i = 0; i < room.data.currentGame.enemiesOnField.length; i++) {
				if (room.data.currentGame.enemiesOnField[i] !== undefined) {
					room.data.currentGame.enemiesOnField[i].move(framesRendered * 0.01 * room.data.currentGame.enemiesOnField[i].defaultSpeed);
					if (room.data.currentGame.enemiesOnField[i].sPosition < 0 && !room.data.currentGame.enemiesOnField[i].reachedBase && !room.data.currentGame.enemiesOnField[i].destroyed) {
						room.data.currentGame.enemiesOnField[i].reachedBase = true;
						room.data.currentGame.baseHealth -= 1;
					}
					if (room.data.currentGame.enemiesOnField[i].sPosition < -0.5) {
						room.data.currentGame.enemiesOnField.splice(i, 1);
					}
				}
			}

			// move score indicators
			for (i = 0; i < room.data.currentGame.scoreGainIndicators.length; i++) {
				room.data.currentGame.scoreGainIndicators[i].ageInMilliseconds += deltaTimeInMilliseconds;
				if (room.data.currentGame.scoreGainIndicators[i].ageInMilliseconds >= 500) {
					room.data.currentGame.scoreGainIndicatorsToDestroy.push(room.data.currentGame.scoreGainIndicators[room.data.currentGame.scoreGainIndicators.indexOf(room.data.currentGame.scoreGainIndicators[i])]);
				}
			}

			// ???
			room.data.currentGame.enemiesOnField = room.data.currentGame.enemiesOnField.filter(function (element) {
				return element != null || element !== undefined;
			});

			// remove things to remove

			for (let i = 0; i < room.data.currentGame.scoreGainIndicatorsToDestroy.length; i++) {
				delete room.data.currentGame.scoreGainIndicators[room.data.currentGame.scoreGainIndicatorsToDestroy[i].toString()];
			}
			room.data.currentGame.scoreGainIndicatorsToDestroy = [];
		}
	} else if (room.type == modes.DEFAULT_MULTIPLAYER) {
		if (room.playing && room.data.currentGame.playersAlive.length > 1) {
			// variables
			var framesRendered = (deltaTimeInMilliseconds * FRAMES_PER_SECOND) / 1000;

			// counters
			// general stats
			room.data.currentGame.currentInGameTimeInMilliseconds += deltaTimeInMilliseconds;

			// game stats (not shown)
			room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds += deltaTimeInMilliseconds;
			
			// technical stats
			room.data.currentGame.framesRenderedSinceGameStart += framesRendered;

			// things to apply to all players
			room.data.currentGame.globalEnemyToAdd = null;

			if (room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds > 50) {
				if (Math.random() > 0.95) {
					room.data.currentGame.globalEnemyToAdd = new enemy.Enemy(1360, 120, 100, 100, generateRandomEnemyTerm(), Math.random() * 2 + 1, 1, 1, room.data.currentGame.globalEnemiesCreated + 1);
					room.data.currentGame.globalEnemiesCreated++;
				}
				room.data.currentGame.enemyGenerationElapsedTimeCounterInMilliseconds -= 50;
			}

			// loop through all the players
			let playersAliveThisUpdate = room.data.currentGame.playersAlive;
			for (let i = 0; i < playersAliveThisUpdate.length; i++) {
				// base health
				if (room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.baseHealth <= 0) {
					room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.dead = true;
				}

				// combo
				room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds += deltaTimeInMilliseconds;

				if (room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.currentCombo > -1 && room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds > 5000) {
					room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.currentCombo = -1;
				}

				// enemy management

				// create sent
				if (room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.sentEnemiesToSpawn > 0) {
					let nameToPutOnEnemy = room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemySenders[0];
					room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemySenders.splice(0, 1);
					room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField[room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesCreated] = new enemy.Enemy(
						1360,
						120,
						100,
						100,
						generateRandomEnemyTerm(),
						Math.random() * 2 + 1,
						1,
						1,
						room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesCreated + 1,
						nameToPutOnEnemy
					);
					room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesCreated++;
					room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.sentEnemiesToSpawn--;
				}


				// create global if there is one
				if (room.data.currentGame.globalEnemyToAdd != null) {
					room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField[room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesCreated] = _.cloneDeep(room.data.currentGame.globalEnemyToAdd);
					room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesCreated++;
				}

				// move

				for (j = 0; j < room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField.length; j++) {
					if (room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField[j] !== undefined) {
						room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField[j].move(framesRendered * 0.01 * room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField[j].defaultSpeed);
						if (
							room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField[j].sPosition < 0 &&
							!room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField[j].reachedBase &&
							!room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField[j].destroyed
						) {
							room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField[j].reachedBase = true;
							room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.baseHealth -= 1;
						}
						if (room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField[j].sPosition < -0.5) {
							room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField.splice(j, 1);
						}
					}
				}

				// move score indicators
				for (j = 0; j < room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicators.length; j++) {
					room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicators[j].ageInMilliseconds += deltaTimeInMilliseconds;
					if (room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicators[j].ageInMilliseconds >= 500) {
						room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicatorsToDestroy.push(
							room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicators[
								room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicators.indexOf(room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicators[j])
							]
						);
					}
				}

				// remove things to remove
				for (let i = 0; i < room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicatorsToDestroy.length; i++) {
					delete room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicators[room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicatorsToDestroy[i].toString()];
				}
				room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesSentIndicatorsToDestroy = [];

				room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField = room.data.currentGame.players[playersAliveThisUpdate[i]].currentGame.enemiesOnField.filter(function (element) {
					return element != null || element !== undefined;
				});
			}
		}
	}
}

function createNewSingleplayerGameData(mode, roomID) {
	switch (mode) {
		case modes.SINGLEPLAYER: {
			var data = {
				id: roomID,

				mode: mode,

				currentGame: {
					mode: mode,

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
	var data = {
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
				},
			},
		},
	};
	return data;
}

function createNewDefaultMultiplayerRoomPlayerObject(socket) {
	let data = {
		playerName: socket.loggedIn ? socket.usernameOfSocketOwner : socket.guestNameOfSocketOwner,
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

async function submitSingleplayerGame(socket, finalGameData, userIDOfSocketOwner) {
	if (userIDOfSocketOwner === undefined) {
		console.log(log.addMetadata("A guest user submitted a score of " + finalGameData.currentScore, "info"));
		socket.emit("finalRanks", false, false, false);
		return;
	}

	let finalScore = finalGameData.currentScore;
	let userIDAsString = userIDOfSocketOwner.toString();
	let usernameOfSocketOwner = JSON.parse(JSON.stringify(await schemas.getUserModel().findById(userIDAsString))).username;
	let personalBestBroken = false;

	let playerDataOfSocketOwner = await schemas.getUserModel().findById(userIDAsString);

	if (playerDataOfSocketOwner["statistics"]["personalBestScore"] === undefined) {
		// personal best field doesn't exist
		// so create one, and assign the score to the field
		await schemas.getUserModel().findByIdAndUpdate(userIDAsString, { $set: { "statistics.personalBestScore": finalScore } }, { upsert: true }, (error3, result3) => {
			if (error3) {
				// console.log(log.addMetadata("ERROR from Socket " + socket.id + " (" + usernameOfSocketOwner + "): ", "info"));
				console.log(log.addMetadata(error3, "info"));
			}
			return result3;
		});

		personalBestBroken = true;
	} else {
		// personal best field exists

		if (finalScore > playerDataOfSocketOwner["statistics"]["personalBestScore"]) {
			// score is higher than personal best

			await schemas.getUserModel().findByIdAndUpdate(userIDAsString, { $set: { "statistics.personalBestScore": finalScore } }, { upsert: true }, (error4, result4) => {
				if (error4) {
					console.log(log.addMetadata(error4, "info"));
				}
				return result4;
			});

			personalBestBroken = true;
		}
	}

	// global leaderboards

	let globalRank = await checkAndModifyLeaderboards(finalScore, usernameOfSocketOwner, userIDOfSocketOwner, userIDAsString);
	socket.emit("finalRanks", personalBestBroken, globalRank, true);
	console.log(log.addMetadata(globalRank == -1 ? "User " + usernameOfSocketOwner + " submitted a score of " + finalScore : "User " + usernameOfSocketOwner + " submitted a score of " + finalScore + " and reached #" + globalRank, "info"));
}

async function checkAndModifyLeaderboards(score, username, userID, userIDAsString) {
	var placePlayerRanked = -1;
	var placePlayerRankedBefore = -1;

	// main check #1

	for (var i = 1; i <= 50; i++) {
		var data = await schemas.getLeaderboardsModel().find({ rankNumber: i }, function (error2, result2) {
			if (error2) {
				console.log(log.addMetadata(error2.stack, "error"));
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
		var data = await schemas.getLeaderboardsModel().find({ rankNumber: i }, function (error2, result2) {
			if (error2) {
				console.log(log.addMetadata(error2.stack, "error"));
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
		var data = await schemas.getLeaderboardsModel().find({ rankNumber: i }, function (error2, result2) {
			if (error2) {
				console.log(log.addMetadata(error2.stack, "error"));
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
			var data1 = await schemas.getLeaderboardsModel().findOne({ rankNumber: i + 1 });
			await schemas.getLeaderboardsModel().findOneAndUpdate({ rankNumber: i }, { userIDOfHolder: data1.userIDOfHolder, score: data1.score }, function (error4, result4) {
				if (error4) {
					console.log(log.addMetadata(error4.stack, "error"));
				}
				return result4;
			});
		}
	}
	// modify

	for (var i = 50; i >= placePlayerRanked; i--) {
		if (i != 1) {
			var data1 = await schemas.getLeaderboardsModel().findOne({ rankNumber: i - 1 });
			await schemas.getLeaderboardsModel().findOneAndUpdate({ rankNumber: i }, { userIDOfHolder: data1.userIDOfHolder, score: data1.score }, function (error4, result4) {
				if (error4) {
					console.log(log.addMetadata(error4.stack, "error"));
				}
				return result4;
			});
		}
	}

	await schemas.getLeaderboardsModel().findOneAndUpdate({ rankNumber: placePlayerRanked }, { userIDOfHolder: userIDAsString, score: score }, function (error5, result5) {
		if (error5) {
			console.log(log.addMetadata(error5.stack, "error"));
		}
		return result5;
	});

	// print (debug)

	return placePlayerRanked;
}

// MINOR
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

function evaluateProblem(room, socket) {
	switch (room.type) {
		case "singleplayer": {
			if (socket.socketIsHostOfRoomItIsIn) {
				switch ((room.data.currentGame.currentProblemAsText.match("=") || []).length) {
					case 0: {
						let originalProblem = room.data.currentGame.currentProblemAsText;
						let problemToEvaluate = room.data.currentGame.currentProblemAsText.replace(/([0-9a-d])([a-d])/g, "$1*$2");
						while (problemToEvaluate.match(/([0-9a-d])([a-d])/) != null) {
							problemToEvaluate = problemToEvaluate.replace(/([0-9a-d])([a-d])/g, "$1*$2");
						}

						let result = calculateProblem(problemToEvaluate, room);
						let answers = 0;
						let enemiesToKill = [];

						let requestedValues = [];

						if (result) {
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
								for (i = 0; i < enemiesToKill.length; i++) {
									// Reset counter
									room.data.currentGame.framesElapsedSinceLastEnemyKill = 0;
									room.data.currentGame.timeElapsedSinceLastEnemyKillInMilliseconds = 0;

									room.data.currentGame.currentCombo++;

									room.data.currentGame.currentScore += Math.round(
										100 *
											calculateProblemLengthMultiplier(room.data.currentGame.currentProblemAsText.length) *
											calculateComboMultiplier(room.data.currentGame.currentCombo) *
											calculateEnemyPositionMultiplier(enemiesToKill[i].sPosition)
									);

									room.data.currentGame.scoreGainIndicators.push({
										number: room.data.currentGame.enemiesKilled + 1,
										sPosition: enemiesToKill[i].sPosition,
										content:
											"+" +
											Math.round(
												100 *
													calculateProblemLengthMultiplier(room.data.currentGame.currentProblemAsText.length) *
													calculateComboMultiplier(room.data.currentGame.currentCombo) *
													calculateEnemyPositionMultiplier(enemiesToKill[i].sPosition)
											).toString(),
										ageInMilliseconds: 0,
									});

									room.data.currentGame.enemiesOnField[room.data.currentGame.enemiesOnField.indexOf(enemiesToKill[i])].toDestroy = true;

									room.data.currentGame.enemiesKilled++;
								}

								for (i = 0; i < room.data.currentGame.tilesInCurrentProblem.length; i++) {
									let t = new tile.Tile(generateRandomTileTermID(room), i, false, room.data.currentGame.tilesCreated + 1);
									room.data.currentGame.tilesCreated++;
									room.data.currentGame.tilesOnBoard[room.data.currentGame.tilesInCurrentProblem[i]] = t;
								}

								room.data.currentGame.currentProblemAsText = "";
								room.data.currentGame.currentProblemAsBeautifulText = "";
								room.data.currentGame.tilesInCurrentProblem = [];

								enemiesToKill = [];
							}

							return answers > 0 && result !== undefined;
						} else {
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
								for (i = 0; i < enemiesToKill.length; i++) {
									// Reset counter
									room.data.currentGame.framesElapsedSinceLastEnemyKill = 0;
									room.data.currentGame.timeElapsedSinceLastEnemyKillInMilliseconds = 0;

									room.data.currentGame.currentCombo++;

									room.data.currentGame.currentScore += Math.round(
										100 *
											calculateProblemLengthMultiplier(room.data.currentGame.currentProblemAsText.length) *
											calculateComboMultiplier(room.data.currentGame.currentCombo) *
											calculateEnemyPositionMultiplier(enemiesToKill[i].sPosition)
									);

									room.data.currentGame.scoreGainIndicators.push({
										number: room.data.currentGame.enemiesKilled + 1,
										sPosition: enemiesToKill[i].sPosition,
										content:
											"+" +
											Math.round(
												100 *
													calculateProblemLengthMultiplier(room.data.currentGame.currentProblemAsText.length) *
													calculateComboMultiplier(room.data.currentGame.currentCombo) *
													calculateEnemyPositionMultiplier(enemiesToKill[i].sPosition)
											).toString(),
										ageInMilliseconds: 0,
									});

									room.data.currentGame.enemiesOnField[room.data.currentGame.enemiesOnField.indexOf(enemiesToKill[i])].toDestroy = true;

									room.data.currentGame.enemiesKilled++;
								}

								for (i = 0; i < room.data.currentGame.tilesInCurrentProblem.length; i++) {
									let t = new tile.Tile(generateRandomTileTermID(room), i, false, room.data.currentGame.tilesCreated + 1);
									room.data.currentGame.tilesCreated++;
									room.data.currentGame.tilesOnBoard[room.data.currentGame.tilesInCurrentProblem[i]] = t;
								}

								room.data.currentGame.currentProblemAsText = "";
								room.data.currentGame.currentProblemAsBeautifulText = "";
								room.data.currentGame.tilesInCurrentProblem = [];

								enemiesToKill = [];
							}

							return answers > 0 && result !== undefined;
						}
					}
					case 1: {
						let valid = false;
						let problemToEvaluate = room.data.currentGame.currentProblemAsText.replace(/([0-9a-d])([a-d])/g, "$1*$2");
						while (problemToEvaluate.match(/([0-9a-d])([a-d])/) != null) {
							problemToEvaluate = problemToEvaluate.replace(/([0-9a-d])([a-d])/g, "$1*$2");
						}

						let problemOnLeftSide = problemToEvaluate.substring(0, problemToEvaluate.indexOf("="));
						let problemOnRightSide = problemToEvaluate.substring(problemToEvaluate.indexOf("=") + 1);

						if (problemOnLeftSide.match(/[a-d]/) != null) {
							// left side contains variable
						} else {
							// right side contains variable
							let temp = problemOnRightSide;
							problemOnRightSide = problemOnLeftSide;
							problemOnLeftSide = temp;
						}

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

							for (i = 0; i < room.data.currentGame.tilesInCurrentProblem.length; i++) {
								let t = new tile.Tile(generateRandomTileTermID(room), room.data.currentGame.tilesInCurrentProblem[i].slot, false);

								room.data.currentGame.tilesOnBoard[room.data.currentGame.tilesInCurrentProblem[i]] = t;
							}

							room.data.currentGame.currentProblemAsText = "";
							room.data.currentGame.currentProblemAsBeautifulText = "";
							room.data.currentGame.tilesInCurrentProblem = [];
							valid = true;
						}

						return valid;
					}
					default: {
						return false;
					}
				}
			}
			break;
		}
		case "defaultMultiplayer": {
			switch ((room.data.currentGame.players[socket.id].currentGame.currentProblemAsText.match("=") || []).length) {
				case 0: {
					let originalProblem = room.data.currentGame.players[socket.id].currentGame.currentProblemAsText;
					let problemToEvaluate = room.data.currentGame.players[socket.id].currentGame.currentProblemAsText.replace(/([0-9a-d])([a-d])/g, "$1*$2");
					while (problemToEvaluate.match(/([0-9a-d])([a-d])/) != null) {
						problemToEvaluate = problemToEvaluate.replace(/([0-9a-d])([a-d])/g, "$1*$2");
					}

					let result = calculateProblem(problemToEvaluate, room);
					let answers = 0;
					let enemiesToKill = [];

					let requestedValues = [];

					if (result) {
						for (i = 0; i < room.data.currentGame.players[socket.id].currentGame.enemiesOnField.length; i++) {
							requestedValues.push(
								room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i] === undefined && room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i].sPosition < 0
									? undefined
									: room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i].requestedValue
							);
						}

						for (i = 0; i < requestedValues.length; i++) {
							if (result == calculateProblem(requestedValues[i], room) || (requestedValues[i] !== undefined ? originalProblem.toString() == requestedValues[i].toString() : false)) {
								answers++;
								enemiesToKill.push(room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i]);
							}
						}

						if (answers > 0 && result !== undefined) {
							for (i = 0; i < enemiesToKill.length; i++) {
								let enemiesSent = Math.floor(
									((room.data.currentGame.players[socket.id].currentGame.currentProblemAsText.length - 3) / 1.05 +
										(room.data.currentGame.players[socket.id].currentGame.currentCombo - 2) +
										(enemiesToKill[i].sPosition - 5) / 1.25 +
										2) /
										1.25
								);
								// Reset counter
								room.data.currentGame.players[socket.id].currentGame.framesElapsedSinceLastEnemyKill = 0;
								room.data.currentGame.players[socket.id].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds = 0;

								room.data.currentGame.players[socket.id].currentGame.currentCombo++;

								room.data.currentGame.players[socket.id].currentGame.enemiesSentIndicators.push({
									number: room.data.currentGame.players[socket.id].currentGame.enemiesKilled + 1,
									sPosition: enemiesToKill[i].sPosition,
									content: Math.max(0, enemiesSent).toString(),

									ageInMilliseconds: 0,
								});

								room.data.currentGame.players[socket.id].currentGame.enemiesSent += Math.max(0, enemiesSent);

								let playerToSendEnemiesTo = _.sample(room.data.currentGame.players);
								while (playerToSendEnemiesTo.currentGame.connectionID == socket.id) {
									playerToSendEnemiesTo = _.sample(room.data.currentGame.players);
								}

								while (enemiesSent > 0) {
									if (room.data.currentGame.players[socket.id].currentGame.enemiesPending <= 0) {
										room.data.currentGame.players[playerToSendEnemiesTo.currentGame.connectionID].currentGame.enemiesPending += 1;
										room.data.currentGame.players[playerToSendEnemiesTo.currentGame.connectionID].currentGame.enemySenders.push(room.data.currentGame.players[socket.id].currentGame.playerName);
								
									} else {
										room.data.currentGame.players[socket.id].currentGame.enemiesPending -= 1;
									}
									enemiesSent--;
								}

								// console.log(log.addMetadata(room.data.currentGame.players[playerToSendEnemiesTo.currentGame.connectionID].currentGame.playerName + " now has " + room.data.currentGame.players[playerToSendEnemiesTo.currentGame.connectionID].currentGame.enemiesPending + " pending enemies.", "info"));

								room.data.currentGame.players[socket.id].currentGame.enemiesOnField[room.data.currentGame.players[socket.id].currentGame.enemiesOnField.indexOf(enemiesToKill[i])].toDestroy = true;

								room.data.currentGame.players[socket.id].currentGame.enemiesKilled++;
							}

							for (i = 0; i < room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem.length; i++) {
								let t = new tile.Tile(getMultiplayerTileQueueOfPlayer(room, socket), i, false, room.data.currentGame.players[socket.id].currentGame.tilesCreated + 1);
								room.data.currentGame.players[socket.id].currentGame.tilesCreated++;
								room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem[i]] = t;
							}

							room.data.currentGame.players[socket.id].currentGame.currentProblemAsText = "";
							room.data.currentGame.players[socket.id].currentGame.currentProblemAsBeautifulText = "";
							room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem = [];

							enemiesToKill = [];
						}

						return answers > 0 && result !== undefined;
					} else {
						for (i = 0; i < room.data.currentGame.players[socket.id].currentGame.enemiesOnField.length; i++) {
							requestedValues.push(
								room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i] === undefined && room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i].sPosition < 0
									? undefined
									: room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i].requestedValue
							);
						}

						for (i = 0; i < requestedValues.length; i++) {
							if (result == calculateProblem(requestedValues[i], room) || (requestedValues[i] !== undefined ? originalProblem.toString() == requestedValues[i].toString() : false)) {
								answers++;
								enemiesToKill.push(room.data.currentGame.players[socket.id].currentGame.enemiesOnField[i]);
							}
						}

						if (answers > 0 && result !== undefined) {
							for (i = 0; i < enemiesToKill.length; i++) {
								// Reset counter
								let enemiesSent = Math.floor(
									((room.data.currentGame.players[socket.id].currentGame.currentProblemAsText.length - 3) / 1.05 +
										(room.data.currentGame.players[socket.id].currentGame.currentCombo - 2) +
										(enemiesToKill[i].sPosition - 5) / 1.25 +
										2) /
										1.25
								);
								// Reset counter
								room.data.currentGame.players[socket.id].currentGame.framesElapsedSinceLastEnemyKill = 0;
								room.data.currentGame.players[socket.id].currentGame.timeElapsedSinceLastEnemyKillInMilliseconds = 0;

								room.data.currentGame.players[socket.id].currentGame.currentCombo++;



								room.data.currentGame.players[socket.id].currentGame.enemiesSentIndicators.push({
									number: room.data.currentGame.players[socket.id].currentGame.enemiesKilled + 1,
									sPosition: enemiesToKill[i].sPosition,
									content: Math.max(0, enemiesSent).toString(),

									ageInMilliseconds: 0,
								});

								room.data.currentGame.players[socket.id].currentGame.enemiesSent += Math.max(0, enemiesSent);

								let playerToSendEnemiesTo = _.sample(room.data.currentGame.players);
								while (playerToSendEnemiesTo.currentGame.connectionID == socket.id) {
									playerToSendEnemiesTo = _.sample(room.data.currentGame.players);
								}

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

							for (i = 0; i < room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem.length; i++) {
								let t = new tile.Tile(getMultiplayerTileQueueOfPlayer(room, socket), i, false, room.data.currentGame.players[socket.id].currentGame.tilesCreated + 1);
								room.data.currentGame.players[socket.id].currentGame.tilesCreated++;
								room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem[i]] = t;
							}

							room.data.currentGame.players[socket.id].currentGame.currentProblemAsText = "";
							room.data.currentGame.players[socket.id].currentGame.currentProblemAsBeautifulText = "";
							room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem = [];

							enemiesToKill = [];
						}

						return answers > 0 && result !== undefined;
					}
				}
				case 1: {
					let valid = false;
					let problemToEvaluate = room.data.currentGame.players[socket.id].currentGame.currentProblemAsText.replace(/([0-9a-d])([a-d])/g, "$1*$2");
					while (problemToEvaluate.match(/([0-9a-d])([a-d])/) != null) {
						problemToEvaluate = problemToEvaluate.replace(/([0-9a-d])([a-d])/g, "$1*$2");
					}

					let problemOnLeftSide = problemToEvaluate.substring(0, problemToEvaluate.indexOf("="));
					let problemOnRightSide = problemToEvaluate.substring(problemToEvaluate.indexOf("=") + 1);

					if (problemOnLeftSide.match(/[a-d]/) != null) {
						// left side contains variable
					} else {
						// right side contains variable
						let temp = problemOnRightSide;
						problemOnRightSide = problemOnLeftSide;
						problemOnLeftSide = temp;
					}

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

						for (i = 0; i < room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem.length; i++) {
							let t = new tile.Tile(getMultiplayerTileQueueOfPlayer(room, socket), i, false, room.data.currentGame.players[socket.id].currentGame.tilesCreated + 1);
							room.data.currentGame.players[socket.id].currentGame.tilesCreated++;
							room.data.currentGame.players[socket.id].currentGame.tilesOnBoard[room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem[i]] = t;
						}

						room.data.currentGame.players[socket.id].currentGame.currentProblemAsText = "";
						room.data.currentGame.players[socket.id].currentGame.currentProblemAsBeautifulText = "";
						room.data.currentGame.players[socket.id].currentGame.tilesInCurrentProblem = [];
						valid = true;
					}

					return valid;
				}
				default: {
					return false;
				}
			}
			break;
		}
	}
}

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

function calculateProblem(problem, room) {
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
	return Math.pow(1.1, Math.max(combo, 0));
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
		evaluateProblem(room, socket);
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
