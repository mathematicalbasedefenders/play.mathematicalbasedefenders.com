// main modules
const http = require("http");
const util = require("util");
// express.js
const express = require("express");
const app = express();
app.use(express.static("public"));

// socket.io
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// mongoose
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// bcrypt
const bcrypt = require("bcrypt");

// lzstring
const LZString = require("lz-string");

// other files
const credentials = require("./credentials/credentials.js");
const game = require("./server/game.js");
const utilities = require("./server/utilities.js");

const schemas = require("./server/core/schemas.js");

const tile = require("./server/game/tile.js");

// other stuff
const PORT = 8000;
const DESIRED_UPDATES_PER_SECOND = 60;
const LOOP_INTERVAL = 1000 / DESIRED_UPDATES_PER_SECOND;

const LOG_DATA_SENT = false;

// variables
var sockets = [];
var rooms = {};

var roomTypes = {
	SINGLEPLAYER: "singleplayer",
	MULTIPLAYER: "multiplayer",
};

var modes = {
	SINGLEPLAYER: "singleplayer",
	MULTIPLAYER: "multiplayer",
};

// Loop variables
var currentTime = Date.now();
var deltaTime = Date.now();
var lastUpdateTime = Date.now();

mongoose.connect(credentials.getMongooseURI(), { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.on("connected", () => {
	console.log("Successfully connected to mongoose.");
});

var ObjectId = require("mongoose").Types.ObjectId;

app.get("/", (request, response) => {
	response.sendFile(__dirname + "/index.html");
});

var timeSinceLastTimeStatsPrintedInMilliseconds = 0;
var dataSentWithoutCompression = 0;
var dataSentWithCompression = 0;

function update(deltaTime) {
	timeSinceLastTimeStatsPrintedInMilliseconds += deltaTime;
	var activeRoomIDs = Object.keys(rooms);
	// console.log("Rooms: " + activeRoomIDs.length);
	if (LOG_DATA_SENT && timeSinceLastTimeStatsPrintedInMilliseconds >= 1000) {
		console.log(dataSentWithCompression + " bytes sent (" + dataSentWithoutCompression + " bytes sent without compression)");
		timeSinceLastTimeStatsPrintedInMilliseconds -= 1000;
		dataSentWithCompression = 0;
		dataSentWithoutCompression = 0;
	}
	for (var roomID of activeRoomIDs) {
		if (roomID.length == 8) {
			if (rooms[roomID].playing) {
				dataSentWithoutCompression += new TextEncoder().encode(JSON.stringify(rooms[roomID].data)).length;
				dataSentWithCompression += new TextEncoder().encode(LZString.compress(JSON.stringify(rooms[roomID].data))).length;
				game.computeUpdate(rooms[roomID], deltaTime);
				// console.log((new TextEncoder().encode(JSON.stringify(rooms[roomID].data))).length + " bytes -> " + (new TextEncoder().encode(LZString.compress(JSON.stringify(rooms[roomID].data)))).length + " bytes");
				io.to(roomID).emit("roomData", LZString.compress(JSON.stringify(rooms[roomID].data)));
				// why?
				for (let enemy in rooms[roomID].data.currentGame.enemiesOnField) {
					if (rooms[roomID].data.currentGame.enemiesOnField[enemy].toDestroy) {
						delete rooms[roomID].data.currentGame.enemiesOnField[enemy];
					}
				}
			} else if (rooms[roomID].data.currentGame.gameIsOver && !rooms[roomID].data.currentGame.gameOverScreenShown) {
				io.to(roomID).emit("roomData", LZString.compress(JSON.stringify(rooms[roomID].data)));
				rooms[roomID].data.currentGame.gameOverScreenShown = true;
			}
		}
		let connections = io.sockets.adapter.rooms.get(roomID);
		if (!connections) {
			delete rooms[roomID];
		}
	}
}

var loop = setInterval(() => {
	currentTime = Date.now();
	deltaTime = currentTime - lastUpdateTime;
	update(deltaTime);
	lastUpdateTime = Date.now();
}, LOOP_INTERVAL);

io.on("connection", (socket) => {
	sockets.push(socket);
	console.log("New connection! There are now " + sockets.length + " connections.");

	var playerDataOfSocketOwner; // use this

	var currentRoomSocketIsIn = "";
	var ownerOfSocketIsPlaying = false;
	var socketIsHostOfRoomItIsIn = false;

	var usernameOfSocketOwner;
	var userIDOfSocketOwner;

	var playerData; // dont use this

	// disconnect
	socket.on("disconnect", () => {
		socket.leave(currentRoomSocketIsIn);
		currentRoomSocketIsIn = "";
		sockets.splice(sockets.indexOf(socket), 1);
	});

	// input
	socket.on("keypress", async (keyCode, location) => {
		if (ownerOfSocketIsPlaying) {
			if (keyCode != 27) {
				// Escape
				if (socketIsHostOfRoomItIsIn) {
					if (location == 3) {
						game.forceSelectTileWithTermID(game.convertPressedKeyToTermID(keyCode, true, rooms[currentRoomSocketIsIn]), rooms[currentRoomSocketIsIn]);
					} else {
						game.forceSelectTileWithTermID(game.convertPressedKeyToTermID(keyCode, false, rooms[currentRoomSocketIsIn]), rooms[currentRoomSocketIsIn]);
					}
				}
			} else {
				socket.leave(currentRoomSocketIsIn);
				currentRoomSocketIsIn = "";
				ownerOfSocketIsPlaying = false;
			}
		}
	});

	// functions: main

	/**
	 * Authenticates the user.
	 */
	socket.on("authenticate", async (username, encodedPassword) => {
		console.log("Log in attempt from " + username);

		decodedPassword = new Buffer(new Buffer(new Buffer(new Buffer(encodedPassword, "base64").toString(), "base64").toString(), "base64").toString(), "base64").toString();
		playerData = await schemas.getUserModel().findOne({ username: username });

		bcrypt.compare(decodedPassword, playerData.hashedPassword, (passwordError, passwordResult) => {
			if (passwordError) {
				console.log(passwordError);
			} else {
				if (passwordResult) {
					console.log("Correct password for " + username + "!");
					usernameOfSocketOwner = playerData.username;
					userIDOfSocketOwner = playerData["_id"].toString();
				} else {
					console.log("Incorrect password for " + username + "!");
				}
			}
		});
	});

	/**
	 * Creates a room.
	 */
	socket.on("createAndJoinRoom", async () => {
		let roomID = undefined;
		while (roomID === undefined || roomID in rooms) {
			roomID = utilities.generateRoomID();
		}
		console.log(roomID);

		currentRoomSocketIsIn = roomID;
		socketIsHostOfRoomItIsIn = true;

		rooms[roomID] = {
			id: roomID,
			type: roomTypes.SINGLEPLAYER,
			host: socket,
			userIDOfHost: userIDOfSocketOwner,
			playing: false,
			data: game.createNewGameData(modes.SINGLEPLAYER, roomID),
		};

		socket.join(roomID);
	});

	socket.on("leaveRoom", async () => {
		socket.leave(currentRoomSocketIsIn);
		currentRoomSocketIsIn = "";
		ownerOfSocketIsPlaying = false;
	});

	/**
	 * Creates a singleplayer room and starts the game.
	 */
	socket.on("startSingleplayerGame", async () => {
		initializeSingleplayerGame(rooms[currentRoomSocketIsIn]);
		ownerOfSocketIsPlaying = true;
		rooms[currentRoomSocketIsIn].playing = true;
	});

	// functions: game

	/**
	 * Processes an action.
	 */
	socket.on("action", () => {
		if (socketIsHostOfRoomItIsIn) {
			rooms[currentRoomSocketIsIn].data.currentGame.actionsPerformed++;
		}
	});

	/**
	 *
	 */
	socket.on("tileClick", (slot) => {
		if (socketIsHostOfRoomItIsIn) {
			game.processTileClick(slot, rooms[currentRoomSocketIsIn]);
		}
	});

	socket.on("sendProblem", () => {
		game.evaluateProblem(rooms[currentRoomSocketIsIn], socketIsHostOfRoomItIsIn);
	});
});

function initializeSingleplayerGame(room) {
	for (let i = 0; i < 49; i++) {
		room.data.currentGame.tilesOnBoard[i] = new tile.Tile(game.generateRandomTileTermID(room), i, false, room.data.currentGame.tilesCreated + 1);
		room.data.currentGame.tilesCreated++;
	}
}

server.listen(PORT, () => {
	console.log(`Listening at localhost:${PORT}`);
});
