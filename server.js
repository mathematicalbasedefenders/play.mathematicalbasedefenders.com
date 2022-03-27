const http = require("http");
const util = require("util");
// express.js
const express = require("express");
const app = express();
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

app.use(express.static("public"));
app.use(limiter);
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "connect-src": [
                    "'self'",
                    "'unsafe-inline'",
                    "https://www.googletagmanager.com",
                    "https://www.google-analytics.com",
                    "cdnjs.cloudflare.com"
                ],
                "img-src": ["'self'", "*"],
                "script-src": [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'",
                    "pixijs.download",
                    "code.jquery.com",
                    "www.googletagmanager.com",
                    "cdnjs.cloudflare.com"
                ],
                "script-src-attr": ["'self'", "'unsafe-inline'"]
            }
        },
        crossOriginEmbedderPolicy: false
    })
);

// socket.io
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// mongoose
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// anti xss
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// anti injection
const mongoDBSanitize = require("mongo-sanitize");

// favicon
const favicon = require("serve-favicon");

// other files
const credentials = require("./credentials/credentials.js");
const configuration = require("./server/configuration.js");
const authentication = require("./server/authentication.js");

const game = require("./server/game.js");
const utilities = require("./server/utilities.js");

const schemas = require("./server/core/schemas.js");
const log = require("./server/core/log.js");

const leveling = require("./server/game/leveling.js");
const tile = require("./server/game/tile.js");

const defaults = require("./server/core/defaults.js");

// other stuff
const PORT = 8080;
const DESIRED_UPDATES_PER_SECOND = 60;

const LOOP_INTERVAL = 1000 / DESIRED_UPDATES_PER_SECOND;

// variables
var sockets = [];
var rooms = {};

var roomIDOfDefaultMultiplayerRoom = "";

const roomTypes = {
    SINGLEPLAYER: "singleplayer",
    DEFAULT_MULTIPLAYER: "defaultMultiplayerMode",
    MULTIPLAYER: "multiplayer"
};

const modes = {
    SINGLEPLAYER: "singleplayer",
    DEFAULT_MULTIPLAYER: "defaultMultiplayerMode",
    MULTIPLAYER: "multiplayer"
};

const playerRanks = {
    GAME_MASTER: "gameMaster",
    DEVELOPER: "developer",
    ADMINISTRATOR: "administrator",
    MODERATOR: "moderator",
    CONTRIBUTOR: "contributor",
    TESTER: "tester",
    DONATOR: "donator"
};

app.use(favicon(__dirname + "/public/assets/images/favicon.ico"));

// Loop variables
var currentTime = Date.now();
var deltaTime = Date.now();
var lastUpdateTime = Date.now();

mongoose.connect(credentials.getMongooseURI(), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

mongoose.connection.on("connected", () => {
    console.log(log.addMetadata("Successfully connected to mongoose.", "info"));
});

app.get("/", (request, response) => {
    response.sendFile(__dirname + "/index.html");
});

app.get("*", (request, response) => {
    response.redirect("/");
});

var timeSinceLastTimeStatsPrintedInMilliseconds = 0;
var dataSentWithoutCompression = 0;

var usersCurrentlyAttemptingToLogIn = [];
var guests = [];

function update(deltaTime) {
    timeSinceLastTimeStatsPrintedInMilliseconds += deltaTime;
    var activeRoomIDs = Object.keys(rooms);
    // hub

    // game
    if (timeSinceLastTimeStatsPrintedInMilliseconds >= 1000) {
        io.emit("updateText", "#online-players", sockets.length);

        if (configuration.developerConfiguration.settings.logAmountOfDataSent) {
            console.log(
                log.addMetadata(
                    `${dataSentWithoutCompression
                        .toString()
                        .replace(
                            /\B(?=(\d{3})+(?!\d))/g,
                            ","
                        )} bytes sent in ${timeSinceLastTimeStatsPrintedInMilliseconds}ms.`,
                    "info"
                )
            );
        }

        dataSentWithoutCompression = 0;

        timeSinceLastTimeStatsPrintedInMilliseconds -= 1000;
    }

    for (var roomID of activeRoomIDs) {
        if (roomID.length == 8) {
            // room is default multiplayer room
            if (roomID == roomIDOfDefaultMultiplayerRoom) {
                if (
                    !rooms[roomID].playing &&
                    !rooms[roomIDOfDefaultMultiplayerRoom].readyToStart &&
                    Object.keys(
                        rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom
                    ).length >= 2
                ) {
                    rooms[roomIDOfDefaultMultiplayerRoom].readyToStart = true;
                    rooms[roomIDOfDefaultMultiplayerRoom].timeToStart =
                        new Date(
                            Date.now() +
                                (configuration.developerConfiguration.settings
                                    .impatientMode
                                    ? 250
                                    : 30000)
                        );
                } else if (
                    !rooms[roomID].playing &&
                    rooms[roomIDOfDefaultMultiplayerRoom].readyToStart &&
                    Object.keys(
                        rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom
                    ).length <= 1
                ) {
                    rooms[roomIDOfDefaultMultiplayerRoom].readyToStart = false;
                    rooms[roomIDOfDefaultMultiplayerRoom].timeToStart = "";
                }

                if (
                    rooms[roomIDOfDefaultMultiplayerRoom].readyToStart &&
                    !rooms[roomID].playing
                ) {
                    let timeLeft =
                        rooms[roomIDOfDefaultMultiplayerRoom].timeToStart -
                        Date.now();
                    if (timeLeft <= 0) {
                        rooms[
                            roomIDOfDefaultMultiplayerRoom
                        ].readyToStart = false;
                        startDefaultMultiplayerGame();
                    } else {
                        io.to(roomIDOfDefaultMultiplayerRoom).emit(
                            "defaultMultiplayerRoomAction",
                            "updateStatusText",
                            [
                                "Game starting in " +
                                    Math.floor(timeLeft / 1000).toString() +
                                    " seconds."
                            ]
                        );
                        dataSentWithoutCompression += utilities.getSizeInBytes([
                            "Game starting in " +
                                Math.floor(timeLeft / 1000).toString() +
                                " seconds."
                        ]);
                    }
                } else {
                    io.to(roomIDOfDefaultMultiplayerRoom).emit(
                        "defaultMultiplayerRoomAction",
                        "updateStatusText",
                        [
                            rooms[roomID].playing
                                ? "Game in progress."
                                : "Waiting for 2 or more players."
                        ]
                    );
                    dataSentWithoutCompression += utilities.getSizeInBytes([
                        rooms[roomID].playing
                            ? "Game in progress."
                            : "Waiting for 2 or more players."
                    ]);
                }
            }

            // room is playing
            if (rooms[roomID].playing) {
                if (rooms[roomID].type == "singleplayer") {
                    let connections =
                        rooms[roomID].data.currentGame.playersAlive;
                    game.computeUpdate(rooms[roomID], deltaTime);
                    io.to(roomID).emit(
                        "currentGameData",
                        JSON.stringify(
                            rooms[roomID].data.currentGame.players[
                                connections[0]
                            ]
                        )
                    );
                    dataSentWithoutCompression += utilities.getSizeInBytes(
                        JSON.stringify(
                            rooms[roomID].data.currentGame.players[
                                connections[0]
                            ]
                        )
                    );
                    for (let enemy in rooms[roomID].data.currentGame.players[
                        connections[0]
                    ].currentGame.enemiesOnField) {
                        if (
                            rooms[roomID].data.currentGame.players[
                                connections[0]
                            ].currentGame.enemiesOnField[enemy].toDestroy
                        ) {
                            // FIXME: this?
                            delete rooms[roomID].data.currentGame.players[
                                connections[0]
                            ].currentGame.enemiesOnField[enemy];
                        }
                    }
                } else if (rooms[roomID].type == "defaultMultiplayerMode") {
                    game.computeUpdate(rooms[roomID], deltaTime);
                    let connections =
                        rooms[roomID].data.currentGame.playersAlive;
                    if (connections) {
                        for (let client of connections) {
                            // why?
                            let connection = io.sockets.sockets.get(client);
                            if (client) {
                                if (
                                    rooms[roomID].data.currentGame.players[
                                        client
                                    ]
                                ) {
                                    if (
                                        rooms[
                                            roomID
                                        ].data.currentGame.players.hasOwnProperty(
                                            client
                                        )
                                    ) {
                                        if (
                                            !rooms[roomID].data.currentGame
                                                .players[client].currentGame
                                                .dead
                                        ) {
                                            connection.emit(
                                                "currentGameData",
                                                JSON.stringify(
                                                    constructDefaultMultiplayerGameDataObjectToSend(
                                                        connection
                                                    )
                                                )
                                            );
                                            dataSentWithoutCompression +=
                                                utilities.getSizeInBytes(
                                                    JSON.stringify(
                                                        constructDefaultMultiplayerGameDataObjectToSend(
                                                            connection
                                                        )
                                                    )
                                                );
                                        } else {
                                            // someone got eliminated

                                            if (connection) {
                                                let data =
                                                    constructDefaultMultiplayerGameDataObjectToSend(
                                                        connection
                                                    );
                                                data.currentGame.rank =
                                                    rooms[
                                                        roomID
                                                    ].data.currentGame.playersAlive.length;
                                                if (
                                                    !rooms[roomID].data
                                                        .currentGame.players[
                                                        client
                                                    ].currentGame.forfeited
                                                ) {
                                                    connection.emit(
                                                        "currentGameData",
                                                        JSON.stringify(data)
                                                    );
                                                }
                                                dataSentWithoutCompression +=
                                                    utilities.getSizeInBytes(
                                                        JSON.stringify(data)
                                                    );
                                                connection.ownerOfSocketIsPlaying = false;
                                            }
                                            rooms[
                                                roomID
                                            ].data.currentGame.ranks.push([
                                                [
                                                    rooms[roomID].data
                                                        .currentGame
                                                        .playersAlive.length,
                                                    rooms[
                                                        roomID
                                                    ].data.currentGame.players[
                                                        client
                                                    ].currentGame.playerName.toString(),
                                                    rooms[roomID].data
                                                        .currentGame.players[
                                                        client
                                                    ].currentGame
                                                        .currentInGameTimeInMilliseconds
                                                ]
                                            ]);
                                            rooms[
                                                roomID
                                            ].data.currentGame.playersAlive.splice(
                                                rooms[
                                                    roomID
                                                ].data.currentGame.playersAlive.indexOf(
                                                    client
                                                ),
                                                1
                                            );
                                            // send placements

                                            io.to(roomID).emit(
                                                "defaultMultiplayerRoomAction",
                                                "updateRanks",
                                                [
                                                    rooms[roomID].data
                                                        .currentGame.ranks
                                                ]
                                            );
                                        }
                                    }

                                    for (let enemy in rooms[roomID].data
                                        .currentGame.players[client].currentGame
                                        .enemiesOnField) {
                                        if (
                                            rooms[roomID].data.currentGame
                                                .players[client].currentGame
                                                .enemiesOnField[enemy].toDestroy
                                        ) {
                                            delete rooms[roomID].data
                                                .currentGame.players[client]
                                                .currentGame.enemiesOnField[
                                                enemy
                                            ];
                                        }
                                    }

                                    if (
                                        rooms[roomID].data.currentGame
                                            .playersAlive.length <= 1
                                    ) {
                                        if (
                                            rooms[roomID].data.currentGame
                                                .playersAlive.length == 1
                                        ) {
                                            let winnerSocket =
                                                io.sockets.sockets.get(
                                                    rooms[roomID].data
                                                        .currentGame
                                                        .playersAlive[0]
                                                );
                                            let data =
                                                constructDefaultMultiplayerGameDataObjectToSend(
                                                    winnerSocket
                                                );
                                            if (!data.currentGame) {
                                                data.currentGame = "";
                                            }
                                            data.currentGame.rank =
                                                rooms[
                                                    roomID
                                                ].data.currentGame.playersAlive.length;
                                            data.currentGame.dead = true;
                                            rooms[
                                                roomID
                                            ].data.currentGame.ranks.push([
                                                [
                                                    rooms[roomID].data
                                                        .currentGame
                                                        .playersAlive.length,
                                                    rooms[
                                                        roomID
                                                    ].data.currentGame.players[
                                                        winnerSocket.id
                                                    ].currentGame.playerName.toString(),
                                                    rooms[roomID].data
                                                        .currentGame.players[
                                                        winnerSocket.id
                                                    ].currentGame
                                                        .currentInGameTimeInMilliseconds
                                                ]
                                            ]);
                                            winnerSocket.emit(
                                                "currentGameData",
                                                JSON.stringify(data)
                                            );
                                            winnerSocket.ownerOfSocketIsPlaying = false;
                                            io.to(roomID).emit(
                                                "defaultMultiplayerRoomAction",
                                                "updateRanks",
                                                [
                                                    rooms[roomID].data
                                                        .currentGame.ranks
                                                ]
                                            );
                                            rooms[
                                                roomID
                                            ].data.currentGame.playersAlive = [];
                                        }
                                        rooms[
                                            roomIDOfDefaultMultiplayerRoom
                                        ].readyToStart = true;
                                        rooms[
                                            roomIDOfDefaultMultiplayerRoom
                                        ].timeToStart = new Date(
                                            Date.now() +
                                                (configuration
                                                    .developerConfiguration
                                                    .settings.impatientMode
                                                    ? 250
                                                    : 30000)
                                        );
                                        rooms[
                                            roomIDOfDefaultMultiplayerRoom
                                        ].playing = false;

                                        let connections =
                                            io.sockets.adapter.rooms.get(
                                                roomID
                                            );
                                        for (client in connections) {
                                            let connection =
                                                io.sockets.sockets.get(client);
                                            connection.ownerOfSocketIsPlaying = false;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        let connections = io.sockets.adapter.rooms.get(roomID);
        if (!connections) {
            if (roomID == roomIDOfDefaultMultiplayerRoom) {
                roomIDOfDefaultMultiplayerRoom = "";
            }
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

    io.emit("updateText", "#online-players", sockets.length);

    socket.playerDataOfSocketOwner; // use this

    socket.currentRoomSocketIsIn = "";
    socket.ownerOfSocketIsPlaying = false;
    socket.socketIsHostOfRoomItIsIn = false;
    socket.playerRank = "";
    socket.usernameOfSocketOwner;
    socket.userIDOfSocketOwner;
    socket.loggedIn = false;

    let toBeGuestName = utilities.generateGuestName();
    while (toBeGuestName in guests) {
        toBeGuestName = utilities.generateGuestName();
    }

    socket.guestNameOfSocketOwner = toBeGuestName;
    socket.emit("updateText", "#player-name", socket.guestNameOfSocketOwner);

    // socket.on("getPlayerDataAndUpdateText", (selector, ...dataToGet) => {
    // 	socket.emit("updateText", selector, getPlayerData(socket, ...dataToGet));
    // });

    socket.on(
        "getDataForUserInformationModalAndUpdateText",
        async (nameToUse) => {
            let name = await getPlayerData(nameToUse, "name");
            let data = await getPlayerData(nameToUse, "userObject");

            socket.emit(
                "updateText",
                "#user-information-modal-title",
                `Play data for ${name}`
            );

            if (!/Guest\s[0-9]{8}/gm.test(name) && !/\s+/.test(name)) {
                if (data) {
                    socket.emit(
                        "updateText",
                        "#user-information-modal-text",
                        `
			Total Experience Points: ${
                data.statistics.totalExperiencePoints
            } (Level ${leveling.getLevel(
                            data.statistics.totalExperiencePoints
                        )}) | 
			Easy Mode Personal Best: ${data.statistics.easyModePersonalBestScore} | 
			Standard Mode Personal Best: ${data.statistics.standardModePersonalBestScore} 
		`
                    );
                } else {
                    socket.emit(
                        "updateText",
                        "#user-information-modal-text",
                        "Player not found."
                    );
                }
            } else {
                socket.emit(
                    "updateText",
                    "#user-information-modal-text",
                    `
			This user is playing as a guest. Their scores will not be submitted unless they sign up for an account.
		`
                );
            }
        }
    );

    // disconnect
    socket.on("disconnect", () => {
        let roomToLeave = socket.currentRoomSocketIsIn;

        if (
            roomToLeave != undefined &&
            roomToLeave == roomIDOfDefaultMultiplayerRoom &&
            rooms[roomToLeave] !== undefined
        ) {
            delete rooms[roomToLeave].playersInRoom[socket.id];

            io.to(roomToLeave).emit(
                "defaultMultiplayerRoomAction",
                "updatePlayerList",
                [
                    Object.keys(
                        rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom
                    ).map((player) => {
                        if (
                            rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom[
                                player
                            ].loggedIn
                        ) {
                            return rooms[roomIDOfDefaultMultiplayerRoom]
                                .playersInRoom[player].usernameOfSocketOwner;
                        } else {
                            return rooms[roomIDOfDefaultMultiplayerRoom]
                                .playersInRoom[player].guestNameOfSocketOwner;
                        }
                    })
                ]
            );

            if (rooms[roomToLeave].playing) {
                rooms[roomToLeave].data.currentGame.players[
                    socket.id
                ].currentGame.dead = true;
                rooms[roomToLeave].data.currentGame.players[
                    socket.id
                ].currentGame.forfeited = true;
            }
        }

        socket.leave(socket.currentRoomSocketIsIn);
        socket.currentRoomSocketIsIn = "";
        sockets.splice(sockets.indexOf(socket), 1);
        guests.splice(guests.indexOf(socket.guestNameOfSocketOwner), 1);
    });

    // input
    socket.on("keypress", async (code, playerTileKeybinds) => {
        code = DOMPurify.sanitize(code);

        playerTileKeybinds = DOMPurify.sanitize(playerTileKeybinds);
        playerTileKeybinds = playerTileKeybinds.split(",");

        // validation 1
        if (utilities.checkIfVariablesAreUndefined(code, playerTileKeybinds)) {
            return;
        }

        // validation 2
        if (!Array.isArray(playerTileKeybinds)) {
            return;
        }

        if (socket.currentRoomSocketIsIn != "") {
            if (socket.ownerOfSocketIsPlaying) {
                if (code != "Escape") {
                    switch (rooms[socket.currentRoomSocketIsIn].type) {
                        case modes.SINGLEPLAYER: {
                            if (
                                socket.currentRoomSocketIsIn != "" &&
                                socket.socketIsHostOfRoomItIsIn
                            ) {
                                game.forceSelectTileWithTermID(
                                    game.convertPressedKeyToTermID(
                                        code,
                                        playerTileKeybinds,
                                        rooms[socket.currentRoomSocketIsIn],
                                        socket
                                    ),
                                    rooms[socket.currentRoomSocketIsIn],
                                    socket
                                );
                            }
                            break;
                        }
                        case modes.DEFAULT_MULTIPLAYER: {
                            if (
                                socket.currentRoomSocketIsIn != "" &&
                                socket.ownerOfSocketIsPlaying
                            ) {
                                game.forceSelectTileWithTermID(
                                    game.convertPressedKeyToTermID(
                                        code,
                                        playerTileKeybinds,
                                        rooms[socket.currentRoomSocketIsIn],
                                        socket
                                    ),
                                    rooms[socket.currentRoomSocketIsIn],
                                    socket
                                );
                            }
                            break;
                        }
                    }
                } else {
                    // Escape
                    socket.ownerOfSocketIsPlaying = false;
                    socket.leave(socket.currentRoomSocketIsIn);
                }
            }
        }
    });

    // functions: main

    /**
     * Authenticates the user.
     */
    socket.on("authenticate", async (username, encodedPassword) => {
        username = DOMPurify.sanitize(mongoDBSanitize(username));
        console.log(log.addMetadata("Log in attempt from " + username, "info"));

        if (!usersCurrentlyAttemptingToLogIn.includes(username)) {
            if (/^[a-zA-Z0-9_]*$/g.test(username)) {
                usersCurrentlyAttemptingToLogIn.push(username);
                socket.playerDataOfSocketOwner = await schemas
                    .getUserModel()
                    .findOne({ username: username });

                if (socket.playerDataOfSocketOwner) {
                    let result = await authentication.checkPassword(
                        username,
                        encodedPassword,
                        socket
                    );
                    if (result) {
                        socket.usernameOfSocketOwner =
                            socket.playerDataOfSocketOwner.username;
                        socket.userIDOfSocketOwner =
                            socket.playerDataOfSocketOwner["_id"];
                        socket.emit("loginResult", username, true);
                        usersCurrentlyAttemptingToLogIn.splice(
                            usersCurrentlyAttemptingToLogIn.indexOf(username),
                            1
                        );
                        socket.loggedIn = true;
                        socket.playerRank = getPlayerRank(
                            socket.playerDataOfSocketOwner
                        );
                        let playerLevel = leveling.getLevel(
                            socket.playerDataOfSocketOwner.statistics
                                .totalExperiencePoints
                        );
                        socket.emit(
                            "updateText",
                            "#player-rank",
                            beautifyRankName(socket.playerRank, username)
                        );
                        socket.emit(
                            "updateCSS",
                            "#player-rank",
                            "color",
                            formatPlayerName(socket.playerRank, username)
                        );
                        socket.emit("updateText", "#player-name", username);
                        socket.emit(
                            "updateText",
                            "#secondary-top-bar-container",
                            `Level ${playerLevel}`
                        );

                        console.log(
                            log.addMetadata(
                                `Correct password for ${username}!`
                            ,"info"),
                            
                        );
                    } else {
                        socket.emit("loginResult", username, false);
                        usersCurrentlyAttemptingToLogIn.splice(
                            usersCurrentlyAttemptingToLogIn.indexOf(username),
                            1
                        );
                        console.log(
                            log.addMetadata(
                                `Incorrect password for ${username}!`
                            ,"info"),
                            
                        );
                    }
                } else {
                    console.log(
                        log.addMetadata(
                            "User " + username + " not found!",
                            "info"
                        )
                    );
                    socket.emit("loginResult", username, false);
                    usersCurrentlyAttemptingToLogIn.splice(
                        usersCurrentlyAttemptingToLogIn.indexOf(username),
                        1
                    );
                }
            } else {
                console.log(
                    log.addMetadata("User " + username + " not found!", "info")
                );
                socket.emit("loginResult", username, false);
                usersCurrentlyAttemptingToLogIn.splice(
                    usersCurrentlyAttemptingToLogIn.indexOf(username),
                    1
                );
            }
        } else {
            console.log(
                log.addMetadata(
                    "User " + username + " is already trying to log in!",
                    "info"
                )
            );
            socket.emit("loginResult", username, false);
        }
    });

    /**
     * Creates a singleplayer room.
     */
    socket.on("createAndJoinDefaultSingleplayerRoom", async (gameMode) => {
        if (socket.currentRoomSocketIsIn == "") {
            if (
                gameMode == "easySingleplayerMode" ||
                gameMode == "standardSingleplayerMode"
            ) {
                let roomID = undefined;
                while (roomID === undefined || roomID in rooms) {
                    roomID = utilities.generateRoomID();
                }

                socket.currentRoomSocketIsIn = roomID;
                socket.socketIsHostOfRoomItIsIn = true;

                rooms[roomID] = {
                    id: roomID,
                    type: roomTypes.SINGLEPLAYER,
                    host: socket,
                    userIDOfHost: socket.userIDOfSocketOwner,
                    playing: false,
                    gameMode: gameMode,
                    data: defaults.createNewDefaultSingleplayerGameData(
                        modes.SINGLEPLAYER,
                        roomID,
                        gameMode,
                        socket
                    )
                };

                socket.join(roomID);
                initializeSingleplayerGame(
                    rooms[socket.currentRoomSocketIsIn],
                    gameMode,
                    socket.id
                );
                socket.ownerOfSocketIsPlaying = true;
                rooms[
                    socket.currentRoomSocketIsIn
                ].data.currentGame.playersAlive = [socket.id];
                rooms[socket.currentRoomSocketIsIn].playing = true;
            } else {
                console.error(
                    log.addMetadata(
                        gameMode + " is not a valid Singleplayer game mode!",
                        "error"
                    )
                );
            }
        } else {
            console.log(
                log.addMetadata("Socket is already in a room!", "info")
            );
        }
    });

    /**
     * Creates a singleplayer room.
     */
    socket.on("createAndJoinCustomSingleplayerRoom", async (settings) => {
        // sanitize data
        settings = JSON.parse(settings);

        if (socket.currentRoomSocketIsIn == "") {
            let dataValidationResult =
                game.performDataValidationForCustomSingleplayerMode(settings);
            if (dataValidationResult.good) {
                let roomID = undefined;
                while (roomID === undefined || roomID in rooms) {
                    roomID = utilities.generateRoomID();
                }

                socket.currentRoomSocketIsIn = roomID;
                socket.socketIsHostOfRoomItIsIn = true;

                rooms[roomID] = {
                    id: roomID,
                    type: roomTypes.SINGLEPLAYER,
                    host: socket,
                    userIDOfHost: socket.userIDOfSocketOwner,
                    playing: false,
                    gameMode: "customSingleplayerMode",
                    data: defaults.createNewCustomSingleplayerGameData(
                        modes.SINGLEPLAYER,
                        roomID,
                        "customSingleplayerMode",
                        socket,
                        settings
                    )
                };

                socket.emit("changeScreen", "singleplayerGameScreen");
                socket.join(roomID);
                initializeSingleplayerGame(
                    rooms[socket.currentRoomSocketIsIn],
                    "customSingleplayerMode",
                    socket.id
                );
                socket.ownerOfSocketIsPlaying = true;
                rooms[
                    socket.currentRoomSocketIsIn
                ].data.currentGame.playersAlive = [socket.id];
                rooms[socket.currentRoomSocketIsIn].playing = true;
            } else {
                let issueMessage = "Unable to start game. (";

                for (let problem in dataValidationResult.problems) {
                    issueMessage += `${problem}: ${dataValidationResult.problems[problem].message}`;
                }

                issueMessage += ")";

                socket.emit(
                    "updateText",
                    "#singleplayer-screen-custom-mode-issues",
                    issueMessage
                );
            }
        } else {
            console.log(
                log.addMetadata("Socket is already in a room!", "info")
            );
        }
    });

    /**
     * Creates or joins the default multiplayer room.
     */
    socket.on("joinOrCreateDefaultMultiplayerRoom", async () => {
        if (socket.currentRoomSocketIsIn == "") {
            if (roomIDOfDefaultMultiplayerRoom == "") {
                let roomID = undefined;
                while (roomID === undefined || roomID in rooms) {
                    roomID = utilities.generateRoomID();
                }

                socket.currentRoomSocketIsIn = roomID;
                roomIDOfDefaultMultiplayerRoom = roomID;
                socket.socketIsHostOfRoomItIsIn = false;

                rooms[roomID] = {
                    id: roomID,
                    type: roomTypes.DEFAULT_MULTIPLAYER,
                    playing: false,
                    data: {},
                    readyToStart: false,
                    timeToStart: "",
                    gameMode: "defaultMultiplayerMode",
                    playersInRoom: {}
                };

                socket.join(roomID);

                rooms[roomID].playersInRoom[socket.id] = socket;

                io.to(roomIDOfDefaultMultiplayerRoom).emit(
                    "defaultMultiplayerRoomAction",
                    "updatePlayerList",
                    [
                        Object.keys(
                            rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom
                        ).map((player) => {
                            if (
                                rooms[roomIDOfDefaultMultiplayerRoom]
                                    .playersInRoom[player].loggedIn
                            ) {
                                return rooms[roomIDOfDefaultMultiplayerRoom]
                                    .playersInRoom[player]
                                    .usernameOfSocketOwner;
                            } else {
                                return rooms[roomIDOfDefaultMultiplayerRoom]
                                    .playersInRoom[player]
                                    .guestNameOfSocketOwner;
                            }
                        })
                    ]
                );
            } else {
                socket.join(roomIDOfDefaultMultiplayerRoom);
                socket.currentRoomSocketIsIn = roomIDOfDefaultMultiplayerRoom;
                rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom[socket.id] =
                    socket;

                io.to(roomIDOfDefaultMultiplayerRoom).emit(
                    "defaultMultiplayerRoomAction",
                    "updatePlayerList",
                    [
                        Object.keys(
                            rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom
                        ).map((player) => {
                            if (
                                rooms[roomIDOfDefaultMultiplayerRoom]
                                    .playersInRoom[player].loggedIn
                            ) {
                                return rooms[roomIDOfDefaultMultiplayerRoom]
                                    .playersInRoom[player]
                                    .usernameOfSocketOwner;
                            } else {
                                return rooms[roomIDOfDefaultMultiplayerRoom]
                                    .playersInRoom[player]
                                    .guestNameOfSocketOwner;
                            }
                        })
                    ]
                );
            }
        } else {
            console.log(
                log.addMetadata("Socket is already in a room!", "info")
            );
        }
    });

    socket.on("leaveRoom", async () => {
        let roomToLeave = socket.currentRoomSocketIsIn;

        if (
            roomToLeave != undefined &&
            roomToLeave == roomIDOfDefaultMultiplayerRoom &&
            rooms[roomToLeave] !== undefined
        ) {
            delete rooms[roomToLeave].playersInRoom[socket.id];

            io.to(roomToLeave).emit(
                "defaultMultiplayerRoomAction",
                "updatePlayerList",
                [
                    Object.keys(
                        rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom
                    ).map((player) => {
                        if (
                            rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom[
                                player
                            ].loggedIn
                        ) {
                            return rooms[roomIDOfDefaultMultiplayerRoom]
                                .playersInRoom[player].usernameOfSocketOwner;
                        } else {
                            return rooms[roomIDOfDefaultMultiplayerRoom]
                                .playersInRoom[player].guestNameOfSocketOwner;
                        }
                    })
                ]
            );
            if (rooms[roomToLeave].playing) {
                rooms[roomToLeave].data.currentGame.players[
                    socket.id
                ].currentGame.baseHealth = 0;
                rooms[roomToLeave].data.currentGame.players[
                    socket.id
                ].currentGame.forfeited = true;
            }
        }

        socket.leave(socket.currentRoomSocketIsIn);
        socket.currentRoomSocketIsIn = "";
    });

    socket.on("defaultMultiplayerRoomChatMessage", async (message) => {
        message = DOMPurify.sanitize(message);
        if (
            socket.currentRoomSocketIsIn == roomIDOfDefaultMultiplayerRoom &&
            message.replace(/\s/g, "").length &&
            message.length < 255
        ) {
            io.to(roomIDOfDefaultMultiplayerRoom).emit(
                "defaultMultiplayerRoomAction",
                "updateChatBox",
                [
                    socket.loggedIn
                        ? socket.usernameOfSocketOwner
                        : socket.guestNameOfSocketOwner,
                    message,
                    formatPlayerName(
                        socket.playerRank,
                        socket.usernameOfSocketOwner
                    )
                ]
            );
        }
    });

    // functions: game

    /**
     * Processes an action.
     */
    socket.on("action", () => {
        if (
            socket.currentRoomSocketIsIn != "" &&
            socket.socketIsHostOfRoomItIsIn
        ) {
            rooms[socket.currentRoomSocketIsIn].data.currentGame
                .actionsPerformed++;
        }
    });

    /**
     *
     */
    socket.on("tileClick", (slot) => {
        slot = slot.toString();
        slot = DOMPurify.sanitize(slot);
        if (utilities.checkIfVariablesAreUndefined(slot)) {
            return;
        }
        if (isNaN(slot)) {
            return;
        } else {
            slot = parseInt(slot);
        }
        if (slot % 1 == 0 && slot >= 0 && slot <= 48) {
            game.processTileClick(
                slot,
                rooms[socket.currentRoomSocketIsIn],
                socket
            );
        }
    });

    socket.on("sendProblem", () => {
        game.checkProblem(rooms[socket.currentRoomSocketIsIn], socket);
    });
});

async function getCurrentPlayerData(socket, ...dataRequested) {
    if (socket.loggedIn) {
        let data = await schemas
            .getUserModel()
            .findOne({ username: socket.usernameOfSocketOwner });

        // strip sensitive information
        data.emailAddress = null;
        data.hashedPassword = null;

        switch (dataRequested[0]) {
            case "name": {
                return socket.loggedIn
                    ? socket.usernameOfSocketOwner
                    : socket.guestNameOfSocketOwner;
            }
            case "level": {
                return leveling.getLevel(data.statistics.totalExperiencePoints);
            }
            case "userObject": {
                return data;
            }
        }
    } else {
        if (dataRequested[0] == "name") {
            return socket.guestNameOfSocketOwner;
        }
        return null;
    }
}

async function getPlayerData(name, ...dataRequested) {
    if (!/Guest\s[0-9]{8}/gm.test(name)) {
        let data = await schemas.getUserModel().findOne({ username: name });

        if (data) {
            // strip sensitive information
            data.emailAddress = null;
            data.hashedPassword = null;

            switch (dataRequested[0]) {
                case "name": {
                    return name;
                }
                case "level": {
                    return leveling.getLevel(
                        data.statistics.totalExperiencePoints
                    );
                }
                case "userObject": {
                    return data;
                }
            }
        } else {
            if (dataRequested[0] == "name") {
                return name;
            }
            return null;
        }
    } else {
        if (dataRequested[0] == "name") {
            return name;
        }
        return null;
    }
}

function getPlayerRank(playerDataOfSocketOwner) {
    if (playerDataOfSocketOwner.username == "mistertfy64") {
        return playerRanks.GAME_MASTER;
    } else if (playerDataOfSocketOwner.membership.isDeveloper) {
        return playerRanks.DEVELOPER;
    } else if (playerDataOfSocketOwner.membership.isAdministrator) {
        return playerRanks.ADMINISTRATOR;
    } else if (playerDataOfSocketOwner.membership.isModerator) {
        return playerRanks.MODERATOR;
    } else if (playerDataOfSocketOwner.membership.isContributor) {
        return playerRanks.CONTRIBUTOR;
    } else if (playerDataOfSocketOwner.membership.isTester) {
        return playerRanks.TESTER;
    } else if (playerDataOfSocketOwner.membership.isDonator) {
        return playerRanks.DONATOR;
    }
}

function formatPlayerName(rank, username) {
    if (username === undefined || username == null) {
        return "#000000";
    }
    if (username == "mistertfy64") {
        return "#ff0000";
    } else if (rank == playerRanks.DEVELOPER) {
        return "#ff0000";
    } else if (rank == playerRanks.ADMINISTRATOR) {
        return "#ff0000";
    } else if (rank == playerRanks.MODERATOR) {
        return "#ff7f00";
    } else if (rank == playerRanks.CONTRIBUTOR) {
        return "#4070ff";
    } else if (rank == playerRanks.TESTER) {
        return "#0194ff";
    } else if (rank == playerRanks.DONATOR) {
        return "#1dc444";
    }
    return "#000000";
}

function beautifyRankName(rank, username) {
    if (username === undefined || username == null) {
        return "";
    }
    if (username == "mistertfy64") {
        return "Game Master";
    } else if (rank == playerRanks.DEVELOPER) {
        return "Developer";
    } else if (rank == playerRanks.ADMINISTRATOR) {
        return "Administrator";
    } else if (rank == playerRanks.MODERATOR) {
        return "Moderator";
    } else if (rank == playerRanks.CONTRIBUTOR) {
        return "Contributor";
    } else if (rank == playerRanks.TESTER) {
        return "Tester";
    } else if (rank == playerRanks.DONATOR) {
        return "Donator";
    }
    return "";
}

function initializeSingleplayerGame(room, mode, player) {
    for (let i = 0; i < 49; i++) {
        room.data.currentGame.players[player].currentGame.tilesOnBoard[i] =
            new tile.Tile(
                game.generateRandomTileTermID(room, player),
                i,
                false,
                room.data.currentGame.players[player].currentGame.tilesCreated +
                    1
            );
        room.data.currentGame.players[player].currentGame.tilesCreated++;
    }
}

async function startDefaultMultiplayerGame(roomID) {
    let connections = io.sockets.adapter.rooms.get(
        roomIDOfDefaultMultiplayerRoom
    );

    rooms[roomIDOfDefaultMultiplayerRoom].data = {
        currentGame: {
            currentInGameTimeInMilliseconds: 0,
            enemyGenerationElapsedTimeCounterInMilliseconds: 0,
            globalEnemiesCreated: 0,
            timeElapsedSinceLastEnemyKillInMilliseconds: 0,
            framesRenderedSinceGameStart: 0,
            players: {},
            globalTileQueues: [],
            globalBagQuantities: [
                4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2
            ],
            globalAvailableTermsIndexes: [
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
            ],
            ranks: []
        }
    };
    rooms[
        roomIDOfDefaultMultiplayerRoom
    ].data.currentGame.globalTileQueues.push(
        game.generateMultiplayerTileQueue()
    );
    rooms[
        roomIDOfDefaultMultiplayerRoom
    ].data.currentGame.globalTileQueues.push(
        game.generateMultiplayerTileQueue()
    );

    let playersAlive = [];

    for (let connection of connections) {
        io.sockets.sockets.get(connection).ownerOfSocketIsPlaying = true;

        let socket = io.sockets.sockets.get(connection);

        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connection
        ] = {};
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connection
        ].currentGame =
            defaults.createNewDefaultMultiplayerRoomPlayerObject(socket);

        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connection
        ].currentGame.mode = "defaultMultiplayerMode";
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connection
        ].currentGame.tilesCreated = 0;
        for (let i = 0; i < 49; i++) {
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connection
            ].currentGame.tilesOnBoard[i] = new tile.Tile(
                rooms[
                    roomIDOfDefaultMultiplayerRoom
                ].data.currentGame.globalTileQueues[0][i],
                i,
                false,
                rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                    connection
                ].currentGame.tilesCreated + 1
            );
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connection
            ].currentGame.tilesCreated++;
        }
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connection
        ].currentGame.tileQueue = [];
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connection
        ].currentGame.tileQueue[0] = [];
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connection
        ].currentGame.tileQueue[1] = JSON.parse(
            JSON.stringify(
                rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame
                    .globalTileQueues[1]
            )
        );
        playersAlive.push(connection);
    }
    rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.playersAlive =
        playersAlive;

    io.to(roomIDOfDefaultMultiplayerRoom).emit(
        "defaultMultiplayerRoomAction",
        "switchToGameContainer"
    );
    rooms[roomIDOfDefaultMultiplayerRoom].playing = true;
}

function constructDefaultMultiplayerGameDataObjectToSend(connection) {
    if (connection) {
        playerIndex = -1;
        let data =
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connection.id
            ];
        data.currentGame.currentInGameTimeInMilliseconds =
            rooms[
                roomIDOfDefaultMultiplayerRoom
            ].data.currentGame.currentInGameTimeInMilliseconds;
        data.currentGame.playersRemaining =
            rooms[
                roomIDOfDefaultMultiplayerRoom
            ].data.currentGame.playersAlive.length;
        data.currentGame.opponentGameData = [];
        // opponents
        let allConnections =
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.playersAlive;
        for (let opponentConnection of allConnections) {
            if (opponentConnection != connection.id) {
                playerIndex++;
                data.currentGame.opponentGameData[playerIndex] =
                    constructMinifiedGameDataObjectToSend(
                        opponentConnection,
                        playerIndex
                    );
            }
        }
        return data;
    }
    return {};
}

// only for use when called by method above
function constructMinifiedGameDataObjectToSend(connectionID, playerIndex) {
    let opponentGameData = {
        playerIndex: playerIndex,
        enemies:
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connectionID
            ].currentGame.enemiesOnField,
        tiles: rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connectionID
        ].currentGame.tilesOnBoard,
        actionsPerMinute: (
            (rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connectionID
            ].currentGame.actionsPerformed /
                (rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame
                    .currentInGameTimeInMilliseconds /
                    1000)) *
            60
        )
            .toFixed(3)
            .toString(),
        baseHealth:
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connectionID
            ].currentGame.baseHealth,
        enemiesPending:
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connectionID
            ].currentGame.enemiesPending,
        name: rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connectionID
        ].currentGame.playerName,
        problem:
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connectionID
            ].currentGame.currentProblemAsBeautifulText,
        nameColor: formatPlayerName(
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connectionID
            ].currentGame.playerRank
        )
    };

    return opponentGameData;
}

server.listen(PORT, () => {
    console.log(log.addMetadata(`Listening at localhost:${PORT}`, "info"));
    if (credentials.getWhetherTestingCredentialsAreUsed()) {
        console.log(
            log.addMetadata("WARNING: Using testing credentials.", "info")
        );
    }
});
