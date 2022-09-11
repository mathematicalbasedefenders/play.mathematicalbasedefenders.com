const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
// express.js
const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const csurf = require("csurf");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const uWS = require("uWebSockets.js");
const multer = require("multer");

const upload = multer();
const csrfProtection = csurf({ cookie: true });

const _ = require("lodash");

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

const WEBSOCKET_PORT = 7000;
const PORT = 8080;

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
const moderation = require("./server/moderation.js");

const credentials = require("./credentials/credentials.js");
const configuration = require("./server/configuration.js");
const authentication = require("./server/authentication.js");

const game = require("./server/game.js");
const tiles = require("./server/game/tiles.js");
const utilities = require("./server/game/utilities.js");

const log = require("./server/core/log.js");

const leveling = require("./server/game/leveling.js");
const evaluation = require("./server/game/evaluation.js");
const generation = require("./server/game/generation.js");
const tile = require("./server/game/constructors/tile.js");
const validation = require("./server/core/validation.js");
const input = require("./server/game/input.js");
const room = require("./server/game/rooms.js");

const global = require("./server/global.js");

const { StringDecoder } = require("string_decoder");
const decoder = new StringDecoder("utf8");

const defaults = require("./server/core/defaults.js");

// other stuff
const DESIRED_UPDATES_PER_SECOND = 60;

const LOOP_INTERVAL = 1000 / DESIRED_UPDATES_PER_SECOND;

const FILE_TYPES = {
    html: "text/html",
    css: "text/css",
    js: "text/js",
    ttf: "font/ttf",
    png: "image/png",
    svg: "image/svg+xml"
};

const jsonParser = bodyParser.json();

app.set("view engine", "ejs");
app.use(favicon(__dirname + "/public/assets/images/favicon.ico"));
app.use(cookieParser());
app.use("/public", express.static("public"));
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
                    "cdnjs.cloudflare.com",
                    `ws://localhost:7000`,
                    `ws://play.mathematicalbasedefenders.com:7000`,
                    `wss://play.mathematicalbasedefenders.com:7000`,
                    `ws://localhost:443`,
                    `ws://play.mathematicalbasedefenders.com:443`,
                    `wss://play.mathematicalbasedefenders.com:443`
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

// variables
global.initialize();
var rooms = Object.create(null);

var roomIDOfDefaultMultiplayerRoom = "";

// models
var User = require("./server/models/User.js");
var EasyModeLeaderboardsRecord = require("./server/models/EasyModeLeaderboardsRecord.js");
var StandardModeLeaderboardsRecord = require("./server/models/StandardModeLeaderboardsRecord.js");

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

// Loop variables
var currentTime = Date.now();
var deltaTime = Date.now();
var lastUpdateTime = Date.now();

mongoose.connect(credentials.getMongooseURI());

mongoose.connection.on("connected", async () => {
    console.log(log.addMetadata("Successfully connected to mongoose.", "info"));
});


app.get("/", csrfProtection, (request, response) => {
    response.render(path.join(__dirname, "index"), {
        csrfToken: request.csrfToken()
    });
});

app.post("/authenticate", jsonParser, csrfProtection, upload.none(), async (request, response) => {
    let connectionID = request.body["guestName"];
    let username = request.body["username"];
    let encodedPassword = request.body["password"];
    if (!/Guest(-|\s)[0-9]{8}/.test(connectionID)) {
        console.warn(log.addMetadata("FORGED REQUEST DETECTED", "warn"));
        response.status(400);
    } else {
        connectionID = connectionID.replace(" ", "-");
        let socketToChangeConnectionID = global.sockets.find((element) => element.connectionID === connectionID);
        if (socketToChangeConnectionID) {
            if (await authentication.authenticate(socketToChangeConnectionID, username, encodedPassword, global.sockets)) {
                socketToChangeConnectionID.connectionID = username;

                let data = await User.findOne({
                    username: username
                });

                // TODO: Write a function that wraps these calls
                socketToChangeConnectionID.variables.userIDOfSocketHolder = data._id;
                socketToChangeConnectionID.variables.playerRank = utilities.getPlayerRank(data, data.username);
                socketToChangeConnectionID.send(
                    JSON.stringify({
                        action: "updateText",
                        arguments: {
                            selector: "#player-rank",
                            text: utilities.beautifyRankName(socketToChangeConnectionID.variables.playerRank, data.username)
                        }
                    })
                );
                socketToChangeConnectionID.send(
                    JSON.stringify({
                        action: "updateText",
                        arguments: {
                            selector: "#player-level-indicator",
                            text: `Level ${leveling.getLevel(data.statistics.totalExperiencePoints)}`
                        }
                    })
                );
                socketToChangeConnectionID.send(
                    JSON.stringify({
                        action: "updateText",
                        arguments: {
                            selector: "#player-name",
                            text: socketToChangeConnectionID.connectionID
                        }
                    })
                );
                socketToChangeConnectionID.send(
                    JSON.stringify({
                        action: "updateCSS",
                        arguments: {
                            selector: "#player-rank",
                            property: "color",
                            value: utilities.formatPlayerName(utilities.getPlayerRank(data), data.username)
                        }
                    })
                );
                socketToChangeConnectionID.send(
                    JSON.stringify({
                        action: "updateCSS",
                        arguments: {
                            selector: "#login-shortcut-button",
                            property: "display",
                            value: "none"
                        }
                    })
                );
                socketToChangeConnectionID.send(
                    JSON.stringify({
                        action: "updateCSS",
                        arguments: {
                            selector: "#player-level-indicator",
                            property: "display",
                            value: "initial"
                        }
                    })
                );
                socketToChangeConnectionID.send(
                    JSON.stringify({
                        action: "updateCSS",
                        arguments: {
                            selector: "#player-level-indicator",
                            property: "display",
                            value: "initial"
                        }
                    })
                );
                socketToChangeConnectionID.send(
                    JSON.stringify({
                        action: "updateCSS",
                        arguments: {
                            selector: "#login-button",
                            property: "display",
                            value: "none"
                        }
                    })
                );
            } else {
                socketToChangeConnectionID.send(
                    JSON.stringify({
                        action: "updateText",
                        arguments: {
                            selector: "#login-button",
                            text: "Login"
                        }
                    })
                );
            }
        } else {
            console.warn(log.addMetadata("FORGED REQUEST DETECTED", "warn"));
        }
    }
});

// app.post(
//     "/send-report",
//     jsonParser,
//     csrfProtection,
//     upload.none(),
//     async (request, response) => {
//         // let reporter = request.body["reporter"];
//         let reportedPlayer = request.body["reportTarget"];
//         let reportDescription = request.body["reportDescription"];
//         console.debug(`reported ${reportedPlayer} for this reason: ${reportDescription}`)
//     }
// );

var timeSinceLastTimeStatsPrintedInMilliseconds = 0;
var dataSentWithoutCompression = 0;

var usersCurrentlyAttemptingToLogIn = [];
var guests = [];

function update(deltaTime) {
    timeSinceLastTimeStatsPrintedInMilliseconds += deltaTime;
    // global
    let activeRoomIDs = Object.keys(rooms);
    // events
    let socketEventQueue = game.getSocketEventQueue();

    // FIXME: I hope this doesn't break... (unsafe?)
    if (socketEventQueue.length > 0) {
        broadcastToEverySocket(
            JSON.stringify({
                action: game.getSocketEventQueue()[0].eventToPublish,
                arguments: game.getSocketEventQueue()[0].arguments
            })
        );
        game.getSocketEventQueue().splice(0, 1);
    }

    // hub

    // game
    if (timeSinceLastTimeStatsPrintedInMilliseconds >= 1000) {
        broadcastToEverySocket(
            JSON.stringify({
                action: "updateText",
                arguments: {
                    selector: "#status-bar__online-players-text",
                    text: global.sockets.length
                }
            })
        );

        if (configuration.developerConfiguration.settings.logAmountOfDataSent) {
            console.log(
                log.addMetadata(
                    `${dataSentWithoutCompression
                        .toString()
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")} bytes sent in ${timeSinceLastTimeStatsPrintedInMilliseconds}ms.`,
                    "info"
                )
            );
        }

        dataSentWithoutCompression = 0;

        timeSinceLastTimeStatsPrintedInMilliseconds -= 1000;
    }

    for (let roomID of activeRoomIDs) {
        if (roomID.length == 8) {
            // room is default multiplayer room
            if (roomID == roomIDOfDefaultMultiplayerRoom) {
                if (
                    !rooms[roomID].playing &&
                    !rooms[roomIDOfDefaultMultiplayerRoom].readyToStart &&
                    Object.keys(rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom).length >= 2
                ) {
                    rooms[roomIDOfDefaultMultiplayerRoom].updateRound = 0;
                    rooms[roomIDOfDefaultMultiplayerRoom].readyToStart = true;
                    rooms[roomIDOfDefaultMultiplayerRoom].timeToStart = new Date(
                        Date.now() + (configuration.developerConfiguration.settings.impatientMode ? 250 : 30000)
                    );
                } else if (
                    !rooms[roomID].playing &&
                    rooms[roomIDOfDefaultMultiplayerRoom].readyToStart &&
                    Object.keys(rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom).length <= 1
                ) {
                    rooms[roomIDOfDefaultMultiplayerRoom].readyToStart = false;
                    rooms[roomIDOfDefaultMultiplayerRoom].timeToStart = "";
                }

                if (rooms[roomIDOfDefaultMultiplayerRoom].readyToStart && !rooms[roomID].playing) {
                    let timeLeft = rooms[roomIDOfDefaultMultiplayerRoom].timeToStart - Date.now();
                    if (timeLeft <= 0) {
                        rooms[roomIDOfDefaultMultiplayerRoom].readyToStart = false;
                        startDefaultMultiplayerGame();
                    } else {
                        broadcastToEverySocketInRoom(
                            roomIDOfDefaultMultiplayerRoom,
                            JSON.stringify({
                                action: "updateText",
                                arguments: {
                                    selector: "#default-multiplayer-room-status-text",
                                    text: "Game starting in " + Math.floor(timeLeft / 1000).toString() + " seconds."
                                }
                            })
                        );
                        dataSentWithoutCompression += utilities.getSizeInBytes(["Game starting in " + Math.floor(timeLeft / 1000).toString() + " seconds."]);
                    }
                } else {
                    broadcastToEverySocketInRoom(
                        roomIDOfDefaultMultiplayerRoom,
                        JSON.stringify({
                            action: "updateText",
                            arguments: {
                                selector: "#default-multiplayer-room-status-text",
                                text: rooms[roomID].playing ? "Game in progress." : "Waiting for 2 or more players."
                            }
                        })
                    );
                    dataSentWithoutCompression += utilities.getSizeInBytes([rooms[roomID].playing ? "Game in progress." : "Waiting for 2 or more players."]);
                }
            }

            // room is playing
            if (rooms[roomID].playing) {
                if (rooms[roomID].type == "singleplayer") {
                    let connections = rooms[roomID].data.currentGame.players;
                    game.computeUpdate(rooms[roomID], deltaTime);

                    //TODO: Move this
                    global.sockets
                        .find((socket) => connections[socket.connectionID] != undefined)
                        ?.send(
                            JSON.stringify({
                                action: "currentGameData",
                                arguments: {
                                    data: rooms[roomID].data.currentGame.players[Object.keys(connections)[0]]
                                }
                            })
                        );
                    dataSentWithoutCompression += utilities.getSizeInBytes(JSON.stringify(rooms[roomID].data.currentGame.players[Object.keys(connections)[0]]));
                    for (let enemy in rooms[roomID].data.currentGame.players[Object.keys(connections)[0]]?.currentGame.enemiesOnField) {
                        if (rooms[roomID].data.currentGame.players[Object.keys(connections)[0]].currentGame.enemiesOnField[enemy].toDestroy) {
                            delete rooms[roomID].data.currentGame.players[Object.keys(connections)[0]].currentGame.enemiesOnField[enemy];
                        }
                    }
                } else if (rooms[roomID].type == "defaultMultiplayerMode") {
                    game.computeUpdate(rooms[roomID], deltaTime);
                    let connections = rooms[roomID].data.currentGame.players;
                    if (connections) {
                        //TODO: check if other unrelated keys appear
                        for (let clientConnectionID of Object.keys(connections)) {
                            if (clientConnectionID) {
                                if (rooms[roomID].data.currentGame.players[clientConnectionID]) {
                                    if (rooms[roomID].data.currentGame.players.hasOwnProperty(clientConnectionID)) {
                                        if (!rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.dead) {
                                            try {
                                                global.sockets
                                                    .find((socket) => socket.connectionID === clientConnectionID)

                                                    ?.send(
                                                        JSON.stringify({
                                                            action: "currentGameData",
                                                            arguments: {
                                                                data: constructDefaultMultiplayerGameDataObjectToSend(clientConnectionID)
                                                            }
                                                        })
                                                    );
                                            } catch (error) {
                                                console.warn(log.addMetadata(error.stack, "warn"));
                                                deleteSocket(global.sockets.find((socket) => socket.connectionID === clientConnectionID));
                                            }
                                            // dataSentWithoutCompression +=
                                            //     utilities.getSizeInBytes(
                                            //         JSON.stringify(
                                            //             constructDefaultMultiplayerGameDataObjectToSend(
                                            //                 connection
                                            //             )
                                            //         )
                                            //     );
                                        } else {
                                            // someone got eliminated
                                           
                                            let userIDOfEliminatedPlayer = utilities.getSocketAccordingToPlayerName(rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.playerName)?.variables.userIDOfSocketOwner || false;
                                            
                                            if (userIDOfEliminatedPlayer) {
                                                leveling.giveExperiencePointsToUserID(
                                                    userIDOfEliminatedPlayer,
                                                    Math.round(rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.experiencePointsEarned)
                                                );
                                                utilities.getSocketAccordingToPlayerName(rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.playerName).send(JSON.stringify({
                                                    action: "addText",
                                                    arguments: {
                                                        selector: "#multiplayer-room-chat-content",
                                                        text: `<div><span>(System)</span>: Added ${Math.round(rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.experiencePointsEarned)} experience points to your account.</div>`,
                                                        useHTML: true
                                                    }
                                                }))
                                            }
                                            rooms[roomID].data.currentGame.ranks.push([
                                                [
                                                    rooms[roomID].data.currentGame.playersAlive.length,
                                                    rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.playerName.toString(),
                                                    rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.currentInGameTimeInMilliseconds,
                                                    rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.enemiesSent
                                                ]
                                            ]);
                                            rooms[roomID].data.currentGame.playersAlive.splice(
                                                rooms[roomID].data.currentGame.playersAlive.indexOf(clientConnectionID),
                                                1
                                            );
                                            if (clientConnectionID) {
                                                let data = constructDefaultMultiplayerGameDataObjectToSend(clientConnectionID);
                                                data.currentGame.rank = rooms[roomID].data.currentGame.playersAlive.length;
                                                if (!rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.forfeited) {
                                                    delete rooms[roomID].data.currentGame.players[clientConnectionID];
                                                    global.sockets
                                                        .find((element) => element.connectionID === clientConnectionID)
                                                        .send(
                                                            JSON.stringify({
                                                                action: "currentGameData",
                                                                arguments: {
                                                                    data: data
                                                                }
                                                            })
                                                        );
                                                }
                                                dataSentWithoutCompression += utilities.getSizeInBytes(JSON.stringify(data));
                                                let socketToClose = global.sockets.find((element) => element.connectionID === clientConnectionID);
                                                if (socketToClose) {
                                                    socketToClose.ownerOfSocketIsPlaying = false;
                                                }
                                                delete rooms[roomID].data.currentGame.players[clientConnectionID];
                                            }

                                            // delete rooms[roomID].data
                                            //     .currentGame.playersAlive[
                                            //     clientConnectionID
                                            // ];
                                            // send placements

                                            // io.to(roomID).emit(
                                            //     "defaultMultiplayerRoomAction",
                                            //     "updateRanks",
                                            //     [
                                            //         rooms[roomID].data
                                            //             .currentGame.ranks
                                            //     ]
                                            // );
                                        }
                                    }

                                    if (rooms[roomID].data.currentGame.players[clientConnectionID]) {
                                        for (let enemy in rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.enemiesOnField) {
                                            if (rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.enemiesOnField[enemy].toDestroy) {
                                                delete rooms[roomID].data.currentGame.players[clientConnectionID].currentGame.enemiesOnField[enemy];
                                            }
                                        }
                                    }
                                    // 1 player remaining - end game
                                    if (Object.keys(rooms[roomID].data.currentGame.players).length <= 1) {
                                        if (rooms[roomID].data.currentGame.playersAlive.length == 1) {
                                            let winnerSocket = global.sockets.find(
                                                (socket) => socket.connectionID === rooms[roomID].data.currentGame.playersAlive[0]
                                            );
                                            let data = constructDefaultMultiplayerGameDataObjectToSend(clientConnectionID);
                                            let userIDOfEliminatedPlayer = winnerSocket?.variables.userIDOfSocketOwner || false;
                                            
                                            if (userIDOfEliminatedPlayer) {
                                                leveling.giveExperiencePointsToUserID(
                                                    userIDOfEliminatedPlayer,
                                                    Math.round(rooms[roomID].data.currentGame.players[winnerSocket.connectionID].currentGame.experiencePointsEarned*1.5)
                                                );

                                                winnerSocket?.send(JSON.stringify({
                                                    action: "addText",
                                                    arguments: {
                                                        selector: "#multiplayer-room-chat-content",
                                                        text: `<div><span>(System)</span>: Added ${Math.round(rooms[roomID].data.currentGame.players[winnerSocket.connectionID].currentGame.experiencePointsEarned*1.5)} experience points to your account.</div>`,
                                                        useHTML: true
                                                    }
                                                }));

                                                if(winnerSocket){
                                                    let userID = utilities.getUserIDOfSocketOwnerIfLoggedIn(winnerSocket);
                                                    if (userID) {User.incrementMultiplayerGamesWonCount(userID);}
                                                }
                                            }

                                            if (!data.currentGame) {
                                                data.currentGame = "";
                                            }
                                            data.currentGame.rank = rooms[roomID].data.currentGame.playersAlive.length;
                                            data.currentGame.dead = true;
                                            rooms[roomID].data.currentGame.ranks.push([
                                                [
                                                    rooms[roomID].data.currentGame.playersAlive.length,
                                                    rooms[roomID].data.currentGame.players[winnerSocket.connectionID].currentGame.playerName.toString(),
                                                    rooms[roomID].data.currentGame.players[winnerSocket.connectionID].currentGame
                                                        .currentInGameTimeInMilliseconds,
                                                    rooms[roomID].data.currentGame.players[winnerSocket.connectionID].currentGame.enemiesSent
                                                ]
                                            ]);
                                            winnerSocket.ownerOfSocketIsPlaying = false;
                                            winnerSocket.send(
                                                JSON.stringify({
                                                    action: "currentGameData",
                                                    arguments: {
                                                        data: data
                                                    }
                                                })
                                            );

                                            winnerSocket.send(
                                                JSON.stringify({
                                                    action: "updateText",
                                                    arguments: {
                                                        selector: "#last-game-ranks-content",
                                                        text: game.formatMultiplayerRoomRanks([rooms[roomID].data.currentGame.ranks]),
                                                        useHTML: true
                                                    }
                                                })
                                            );

                                            broadcastToEverySocketInRoom(
                                                roomID,
                                                JSON.stringify({
                                                    action: "updateText",
                                                    arguments: {
                                                        selector: "#last-game-ranks-content",
                                                        text: game.formatMultiplayerRoomRanks([rooms[roomID].data.currentGame.ranks]),
                                                        useHTML: true
                                                    }
                                                })
                                            );
                                            broadcastToEverySocketInRoom(
                                                roomID,
                                                JSON.stringify({
                                                    action: "changeScreen",
                                                    arguments: {
                                                        newScreen: `defaultMultiplayerRoomLobbyScreen`
                                                    }
                                                })
                                            );
                                            if (winnerSocket) {
                                                rooms[roomID].data.currentGame.playersAlive = [];
                                        }

                                        rooms[roomIDOfDefaultMultiplayerRoom].readyToStart = false;
                                        // rooms[
                                        //     roomIDOfDefaultMultiplayerRoom
                                        // ].timeToStart = new Date(
                                        //     Date.now() +
                                        //         (configuration
                                        //             .developerConfiguration
                                        //             .settings.impatientMode
                                        //             ? 250
                                        //             : 30000)
                                        // );
                                        rooms[roomIDOfDefaultMultiplayerRoom].playing = false;

                                        // let connections = [];
                                        // // io.global.sockets.adapter.rooms.get(
                                        // //     roomID
                                        // // );
                                        // for (clientConnectionID in connections) {
                                        //     let connection =
                                        //         // io.global.sockets.global.sockets.get(client);
                                        //         (connection.ownerOfSocketIsPlaying = false);
                                        // }
                                    }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // TODO: Move this
            let connections = global.sockets.filter((socket) => socket.variables.currentRoomSocketIsIn === roomID);
            if (!connections || connections.length == 0) {
                if (roomID == roomIDOfDefaultMultiplayerRoom) {
                    roomIDOfDefaultMultiplayerRoom = "";
                }
                delete rooms[roomID];
            }
        }
    }
}

var loop = setInterval(() => {
    currentTime = Date.now();
    deltaTime = currentTime - lastUpdateTime;
    update(deltaTime);
    lastUpdateTime = Date.now();
}, LOOP_INTERVAL);

function initializeSingleplayerGame(room, mode, player) {
    for (let i = 0; i < 49; i++) {
        room.data.currentGame.players[player].currentGame.tilesOnBoard[i] = new tile.Tile(
            generation.generateRandomTileTermID(room, player),
            i,
            false,
            room.data.currentGame.players[player].currentGame.tilesCreated + 1
        );
        room.data.currentGame.players[player].currentGame.tilesCreated++;
    }
}

function broadcastToEverySocket(toBroadcast) {
    for (let socket of global.sockets) {
        try {
            socket.send(toBroadcast);
        } catch (error) {
            console.warn(log.addMetadata(error.stack, "warn"));
            deleteSocket(socket);
        }
    }
}

function deleteSocket(socket) {
    // variables
    if (socket.variables.currentRoomSocketIsIn && socket.variables.currentRoomSocketIsIn != "") {
        if (rooms[socket.variables.currentRoomSocketIsIn]?.data?.currentGame?.players[socket.connectionID]) {
            rooms[socket.variables.currentRoomSocketIsIn].data.currentGame.players[socket.connectionID].currentGame.forfeited = true;

            rooms[socket.variables.currentRoomSocketIsIn].data.currentGame.players[socket.connectionID].currentGame.dead = true;
        }
    }
    ``;
    delete rooms[roomIDOfDefaultMultiplayerRoom]?.players?.[socket.connectionID];

    delete rooms[roomIDOfDefaultMultiplayerRoom]?.playersInRoom[socket.connectionID];

    // delete rooms[
    //     global.sockets[global.sockets.indexOf(socket)].variables.currentRoomSocketIsIn
    // ]?.data?.currentGame?.players[socket.connectionID];
    global.sockets.splice(global.sockets.indexOf(socket), 1);
}

async function startDefaultMultiplayerGame(roomID) {
    // get connections (i.e. players) in default room
    let connections = global.sockets.filter((socket) => socket.variables.currentRoomSocketIsIn === roomIDOfDefaultMultiplayerRoom);
    let players = global.sockets.filter((socket) => socket.variables.currentRoomSocketIsIn === roomIDOfDefaultMultiplayerRoom);
    
    // tie data according to each player
    rooms[roomIDOfDefaultMultiplayerRoom].data = {
        currentGame: {
            currentInGameTimeInMilliseconds: 0,
            enemyGenerationElapsedTimeCounterInMilliseconds: 0,
            globalEnemiesCreated: 0,
            timeElapsedSinceLastEnemyKillInMilliseconds: 0,
            framesRenderedSinceGameStart: 0,
            players: {},
            globalTileQueues: [],
            globalBagQuantities: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2],
            globalAvailableTermsIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
            ranks: []
        }
    };
    rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.globalTileQueues.push(tiles.generateMultiplayerTileQueue());
    rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.globalTileQueues.push(tiles.generateMultiplayerTileQueue());

    let playersAlive = [];

    // add players to alive players 
    for (let socket of connections) {
        socket.variables.ownerOfSocketIsPlaying = true;

        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[socket.connectionID] = {};
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[socket.connectionID].currentGame =
            defaults.createNewDefaultMultiplayerRoomPlayerObject(socket);

        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[socket.connectionID].currentGame.mode = "defaultMultiplayerMode";
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[socket.connectionID].currentGame.tilesCreated = 0;
        for (let i = 0; i < 49; i++) {
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[socket.connectionID].currentGame.tilesOnBoard[i] = new tile.Tile(
                rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.globalTileQueues[0][i],
                i,
                false,
                rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[socket.connectionID].currentGame.tilesCreated + 1
            );
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[socket.connectionID].currentGame.tilesCreated++;
        }
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[socket.connectionID].currentGame.tileQueue = [];
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[socket.connectionID].currentGame.tileQueue[0] = [];
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[socket.connectionID].currentGame.tileQueue[1] = JSON.parse(
            JSON.stringify(rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.globalTileQueues[1])
        );
        playersAlive.push(socket.connectionID);
    }
    rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.playersAlive = playersAlive;

    // force everyone to go to game screen
    for (let player of players) {
        player.send(JSON.stringify({ action: "switchToGameContainer" }));
    }



    // set property to playing for room
    rooms[roomIDOfDefaultMultiplayerRoom].playing = true;

    // increment games played count for REGISTERED players
    for (let player of players){
        let connectionID = utilities.getUserIDOfSocketOwnerIfLoggedIn(player);
        if (connectionID) {User.incrementMultiplayerGamesPlayedCount(connectionID, 1);}
    }

}

function constructDefaultMultiplayerGameDataObjectToSend(connection) {
    if (connection) {
        let playerIndex = -1;
        let data = rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[connection];
        if (data?.currentGame) {
            if (rooms[roomIDOfDefaultMultiplayerRoom]?.playersInRoom[connection]?.variables) {
                data.currentGame.nameColor = utilities.formatPlayerName(
                    rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom[connection].variables.playerRank,
                    rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom[connection].variables.loggedIn
                        ? rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom[connection].variables.usernameOfSocketOwner
                        : rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom[connection].variables.guestNameOfSocketOwner
                );
            }
            data.currentGame.currentInGameTimeInMilliseconds = rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.currentInGameTimeInMilliseconds;
            data.currentGame.playersRemaining = rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.playersAlive.length;
            data.currentGame.opponentGameData = [];
            data.currentGame.updateRound = rooms[roomIDOfDefaultMultiplayerRoom].updateRound;

            let allConnections = Object.keys(rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players);

            for (let opponentConnection of allConnections) {
                if (opponentConnection != connection) {
                    playerIndex++;
                    data.currentGame.opponentGameData[playerIndex] = constructMinifiedGameDataObjectToSend(opponentConnection, playerIndex);
                }
            }
            return data;
        }
    }
    return {};
}

// only for use when called by method above
function constructMinifiedGameDataObjectToSend(connectionID, playerIndex) {
    let minifiedOpponentGameData = {};

    minifiedOpponentGameData.playerIndex = playerIndex;

    minifiedOpponentGameData.enemies = minifyEnemies(rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[connectionID].currentGame.enemiesOnField);

    minifiedOpponentGameData.tiles = minifyTiles(rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[connectionID].currentGame.tilesOnBoard);

    minifiedOpponentGameData.actionsPerMinute =
        (rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[connectionID].currentGame.actionsPerformed /
            (rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.currentInGameTimeInMilliseconds / 1000)) *
        60;

    (minifiedOpponentGameData.baseHealth = rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[connectionID].currentGame.baseHealth),
        (minifiedOpponentGameData.enemiesPending = rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[connectionID].currentGame.enemiesPending),
        (minifiedOpponentGameData.name = rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[connectionID].currentGame.playerName),
        (minifiedOpponentGameData.problem =
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[connectionID].currentGame.currentProblemAsBeautifulText),
        (minifiedOpponentGameData.nameColor = utilities.formatPlayerName(
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[connectionID].currentGame.playerRank,
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[connectionID].currentGame.playerName.toString()
        ));

    return minifiedOpponentGameData;
}

function minifyEnemies(enemies) {
    let minifiedEnemies = [];
    for (let i = 0; i < enemies.length; i++) {
        let enemy = enemies[i];
        // index
        // 0 - sPosition
        // 1 - number

        minifiedEnemies.push([enemy?.sPosition, enemy?.enemyNumber]);
    }
    return minifiedEnemies;
}

function minifyTiles(tiles) {
    let minifiedTiles = [];
    for (let i = 0; i < 49; i++) {
        let tile = tiles.find((element) => element.slot == i);
        // index
        // 0 - slot
        // 1 - termID
        // 2 - selected

        minifiedTiles.push([i, tile?.termID, tile?.selected]);
    }
    return minifiedTiles;
}

function broadcastToEverySocketInRoom(room, toBroadcast) {
    let socketsToBroadcastTo = global.sockets.filter((element) => element.variables.currentRoomSocketIsIn === room);
    for (let socket of socketsToBroadcastTo) {
        try {
            socket.send(toBroadcast);
        } catch (error) {
            console.warn(log.addMetadata(error.stack, "warn"));
            deleteSocket(socket);
        }
    }
}

uWS.App()
    .ws("/", {
        // handle messages from client

        open: (socket, req) => {
            socket.variables = {};

            socket.variables.playerDataOfSocketOwner; // use this

            socket.variables.currentRoomSocketIsIn = "";
            socket.variables.ownerOfSocketIsPlaying = false;
            socket.variables.socketIsHostOfRoomItIsIn = false;
            socket.variables.playerRank = "";
            socket.variables.usernameOfSocketOwner;
            socket.variables.userIDOfSocketOwner;
            socket.variables.loggedIn = false;

            let toBeGuestName = utilities.generateGuestName();
            while (toBeGuestName in guests) {
                toBeGuestName = utilities.generateGuestName();
            }

            socket.connectionID = toBeGuestName.replace(" ", "-");

            socket.variables.guestNameOfSocketOwner = toBeGuestName;

            global.sockets.push(socket);

            socket.send(
                JSON.stringify({
                    action: "updateText",
                    arguments: {
                        selector: "#player-name",
                        text: socket.variables.guestNameOfSocketOwner
                    }
                })
            );
        },

        message: async (socket, message, isBinary) => {
            // validation
            if (!validation.checkIfJSONStringIsValid(decoder.write(Buffer.from(message)))) {
                return;
            }

            let parsedMessage = JSON.parse(decoder.write(Buffer.from(message)));
            switch (parsedMessage.action) {
                case "createAndJoinDefaultSingleplayerRoom": {
                    // validation
                    if (socket.variables.currentRoomSocketIsIn === "") {
                        if (parsedMessage.arguments.gameMode == "easySingleplayerMode" || parsedMessage.arguments.gameMode == "standardSingleplayerMode") {
                            let roomID = undefined;
                            while (roomID === undefined || roomID in rooms) {
                                roomID = utilities.generateRoomID();
                            }

                            socket.variables.currentRoomSocketIsIn = roomID;
                            socket.variables.socketIsHostOfRoomItIsIn = true;

                            rooms[roomID] = {
                                id: roomID,
                                type: roomTypes.SINGLEPLAYER,
                                host: socket,
                                userIDOfHost: socket.variables.userIDOfSocketOwner,
                                playing: false,
                                gameMode: parsedMessage.arguments.gameMode,
                                data: defaults.createNewDefaultSingleplayerGameData(modes.SINGLEPLAYER, roomID, parsedMessage.arguments.gameMode, socket)
                            };

                            socket.subscribe(roomID);
                            initializeSingleplayerGame(rooms[socket.variables.currentRoomSocketIsIn], parsedMessage.arguments.gameMode, socket.connectionID);
                            socket.variables.ownerOfSocketIsPlaying = true;
                            rooms[socket.variables.currentRoomSocketIsIn].data.currentGame.playersAlive = [socket.connectionID];
                            rooms[socket.variables.currentRoomSocketIsIn].playing = true;
                        } else {
                            console.error(log.addMetadata(gameMode + " is not a valid Singleplayer game mode!", "error"));
                        }
                    } else {
                        console.log(log.addMetadata("Socket is already in a room!", "info"));
                    }
                    break;
                }
                case "joinOrCreateDefaultMultiplayerRoom": {
                    if (socket.variables.currentRoomSocketIsIn == "") {
                        if (roomIDOfDefaultMultiplayerRoom == "") {
                            let roomID = undefined;
                            while (roomID === undefined || roomID in rooms) {
                                roomID = utilities.generateRoomID();
                            }

                            socket.variables.currentRoomSocketIsIn = roomID;
                            roomIDOfDefaultMultiplayerRoom = roomID;
                            socket.variables.socketIsHostOfRoomItIsIn = false;

                            rooms[roomID] = {
                                id: roomID,
                                type: roomTypes.DEFAULT_MULTIPLAYER,
                                playing: false,
                                data: {},
                                readyToStart: false,
                                timeToStart: "",
                                updateRound: 0,
                                gameMode: "defaultMultiplayerMode",
                                playersInRoom: {}
                            };

                            socket.subscribe(roomID);

                            rooms[roomID].playersInRoom[socket.connectionID] = socket;
                            socket.send(
                                JSON.stringify({
                                    action: "updateMultiplayerPlayerList",
                                    arguments: {
                                        data: room.getRoomPlayers(rooms[roomID])
                                    }
                                })
                            );
                            socket.publish(
                                roomID,
                                JSON.stringify({
                                    action: "updateMultiplayerPlayerList",
                                    arguments: {
                                        data: room.getRoomPlayers(rooms[roomID])
                                    }
                                })
                            );
                        } else {
                            socket.subscribe(roomIDOfDefaultMultiplayerRoom);
                            socket.variables.currentRoomSocketIsIn = roomIDOfDefaultMultiplayerRoom;
                            rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom[socket.connectionID] = socket;
                            

                            socket.send(
                                JSON.stringify({
                                    action: "updateMultiplayerPlayerList",
                                    arguments: {
                                        data: room.getRoomPlayers(rooms[roomID])
                                    }
                                })
                            );
                            socket.publish(
                                roomIDOfDefaultMultiplayerRoom,
                                JSON.stringify({
                                    action: "updateMultiplayerPlayerList",
                                    arguments: {
                                        data: room.getRoomPlayers(rooms[roomID])
                                    }
                                })
                            );
                        }
                    } else {
                        console.log(log.addMetadata("Socket is already in a room!", "info"));
                    }
                    break;
                }
                case "keypress": {
                    let code = parsedMessage.arguments.code;
                    let playerTileKeybinds = parsedMessage.arguments.playerTileKeybinds;
                    code = DOMPurify.sanitize(code);

                    playerTileKeybinds = DOMPurify.sanitize(playerTileKeybinds);
                    playerTileKeybinds = playerTileKeybinds.split(",");

                    // validation 0
                    if (socket.variables.currentRoomSocketIsIn == undefined) {
                        return;
                    }

                    // validation 1
                    if (utilities.checkIfVariablesAreUndefined(code, playerTileKeybinds)) {
                        return;
                    }

                    // validation 2
                    if (!Array.isArray(playerTileKeybinds)) {
                        return;
                    }

                    if (socket.variables.currentRoomSocketIsIn != "") {
                        if (socket.variables.ownerOfSocketIsPlaying) {
                            if (code != "Escape") {
                                switch (rooms[socket.variables.currentRoomSocketIsIn].type) {
                                    case modes.SINGLEPLAYER: {
                                        if (socket.variables.currentRoomSocketIsIn != "" && socket.variables.socketIsHostOfRoomItIsIn) {
                                            tiles.forceSelectTileWithTermID(
                                                tiles.convertPressedKeyToTermID(
                                                    code,
                                                    playerTileKeybinds,
                                                    rooms[socket.variables.currentRoomSocketIsIn],
                                                    socket
                                                ),
                                                rooms[socket.variables.currentRoomSocketIsIn],
                                                socket
                                            );
                                        }
                                        break;
                                    }
                                    case modes.DEFAULT_MULTIPLAYER: {
                                        if (socket.variables.currentRoomSocketIsIn != "" && socket.variables.ownerOfSocketIsPlaying) {
                                            tiles.forceSelectTileWithTermID(
                                                tiles.convertPressedKeyToTermID(
                                                    code,
                                                    playerTileKeybinds,
                                                    rooms[socket.variables.currentRoomSocketIsIn],
                                                    socket
                                                ),
                                                rooms[socket.variables.currentRoomSocketIsIn],
                                                socket
                                            );
                                        }
                                        break;
                                    }
                                }
                            } else {
                                // Escape
                                socket.variables.ownerOfSocketIsPlaying = false;
                                socket.unsubscribe(socket.variables.currentRoomSocketIsIn);
                            }
                        }
                    }
                    break;
                }
                case "leaveRoom": {
                    let roomToLeave = socket.variables.currentRoomSocketIsIn;

                    if (roomToLeave != undefined && roomToLeave == roomIDOfDefaultMultiplayerRoom && rooms[roomToLeave] !== undefined) {
                        broadcastToEverySocketInRoom(
                            roomToLeave,

                            JSON.stringify({
                                action: "updateText",
                                arguments: {
                                    selector: "#default-multiplayer-room-status-text",
                                    text: room.getRoomPlayers(rooms[roomToLeave])
                                }
                            })
                        );
                        if (rooms[roomToLeave].playing && rooms[roomToLeave].data.currentGame.players[socket.connectionID]) {
                            rooms[roomToLeave].data.currentGame.players[socket.connectionID].currentGame.baseHealth = 0;
                            rooms[roomToLeave].data.currentGame.players[socket.connectionID].currentGame.forfeited = true;
                        }
                        delete rooms[roomToLeave].playersInRoom[socket.connectionID];
                    } else {
                        delete rooms[roomToLeave].data.currentGame.players[socket.connectionID];
                    }
                    socket.unsubscribe(socket.variables.currentRoomSocketIsIn);
                    socket.variables.currentRoomSocketIsIn = "";
                    break;
                }
                case "tileClick": {
                    // validation 0
                    if (socket.variables.currentRoomSocketIsIn == undefined) {
                        return;
                    }

                    let slot = parsedMessage.arguments.slot;
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
                        input.processTileClick(slot, rooms[socket.variables.currentRoomSocketIsIn], socket);
                    }
                    break;
                }
                case "chatMessage": {
                    if (/\S/.test(parsedMessage.arguments.message.toString()) && parsedMessage.arguments.message === DOMPurify.sanitize(parsedMessage.arguments.message)) {
                        broadcastToEverySocketInRoom(
                            roomIDOfDefaultMultiplayerRoom,
                            JSON.stringify({
                                action: "prependText",
                                arguments: {
                                    selector: "#multiplayer-room-chat-content",
                                    text: `<div><span style="color:${utilities.formatPlayerName(
                                        socket.variables.playerRank,
                                        utilities.getNameOfSocketOwner(socket)
                                    )}">${utilities.getNameOfSocketOwner(socket)}</span>: ${parsedMessage.arguments.message}</div>`,
                                    useHTML: true
                                }
                            })
                        );
                        break;
                    }
                }
                case "getDataForUser": {
                    // sanitize data
                    if (parsedMessage.arguments.userToGetDataOf !== mongoDBSanitize(parsedMessage.arguments.userToGetDataOf)) {
                        // invalid
                        socket.send(
                            JSON.stringify({
                                action: "updateText",
                                arguments: {
                                    selector: "#user-information-modal-text",
                                    text: `User ${userToGetDataOf} not found.`
                                }
                            })
                        );
                        return;
                    }
                    let userToGetDataOf = mongoDBSanitize(parsedMessage.arguments.userToGetDataOf);
                    socket.send(
                        JSON.stringify({
                            action: "updateText",
                            arguments: {
                                selector: "#user-information-modal-title",
                                text: `User Data for ${userToGetDataOf}`
                            }
                        })
                    );
                    if (/Guest[-\s]{0,1}[0-9]{8}/.test(userToGetDataOf)) {
                        // guest player: return guest data
                        socket.send(
                            JSON.stringify({
                                action: "updateText",
                                arguments: {
                                    selector: "#user-information-modal-text",
                                    text: `This player is playing as a guest. Scores they made will not be submitted unless they sign up.`
                                }
                            })
                        );
                        return;
                    }
                    let data = await User.superSafeFindByUsername(userToGetDataOf);

                    if (!data) {
                        socket.send(
                            JSON.stringify({
                                action: "updateText",
                                arguments: {
                                    selector: "#user-information-modal-text",
                                    text: `User ${userToGetDataOf} not found.`
                                }
                            })
                        );
                        return;
                    }

                    socket.send(
                        JSON.stringify({
                            action: "updateText",
                            arguments: {
                                selector: "#user-information-modal-text",
                                text: `Standard Mode PB: ${data.statistics?.personalBestScoreOnStandardSingleplayerMode.score ?? "N/A"}\nEasy Mode PB: ${
                                    data.statistics?.personalBestScoreOnEasySingleplayerMode.score ?? "N/A"
                                }\n Level ${leveling.getLevel(data.statistics.totalExperiencePoints)}`,
                                useHTML: true
                            }
                        })
                    );

                    break;
                }
                case "createAndJoinCustomSingleplayerRoom": {
                    // sanitize data

                    if (socket.variables.currentRoomSocketIsIn === "") {
                        let dataValidationResult = validation.performDataValidationForCustomSingleplayerMode(parsedMessage.arguments.settings);
                        if (dataValidationResult.good) {
                            let roomID = undefined;
                            while (roomID === undefined || roomID in rooms) {
                                roomID = utilities.generateRoomID();
                            }

                            socket.variables.currentRoomSocketIsIn = roomID;
                            socket.variables.socketIsHostOfRoomItIsIn = true;

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
                                    parsedMessage.arguments.settings
                                )
                            };

                            socket.send(
                                JSON.stringify({
                                    action: "changeScreen",
                                    arguments: {
                                        newScreen: "singleplayerGameScreen"
                                    }
                                })
                            );
                            socket.subscribe(roomID);
                            initializeSingleplayerGame(rooms[socket.variables.currentRoomSocketIsIn], "customSingleplayerMode", socket.connectionID);
                            socket.variables.ownerOfSocketIsPlaying = true;
                            rooms[socket.variables.currentRoomSocketIsIn].data.currentGame.playersAlive = [socket.connectionID];
                            rooms[socket.variables.currentRoomSocketIsIn].playing = true;
                        } else {
                            let issueMessage = "Unable to start game. (";

                            for (let problem in dataValidationResult.problems) {
                                issueMessage += `${problem}: ${dataValidationResult.problems[problem].message}`;
                            }

                            issueMessage += ")";

                            socket.send(
                                JSON.stringify({
                                    action: "updateText",
                                    arguments: {
                                        selector: "#singleplayer-screen-custom-mode-issues",
                                        text: issueMessage
                                    }
                                })
                            );
                        }
                    } else {
                        console.log(log.addMetadata("Socket is already in a room!", "info"));
                    }
                    break;
                }
                case "broadcastMessageAsStaff": {
                    if (
                        !(
                            utilities.getNameOfSocketOwner(socket) === "mistertfy64" ||
                            socket.variables.playerRank === playerRanks.ADMINISTRATOR ||
                            socket.variables.playerRank === playerRanks.MODERATOR
                        )
                    ) {
                        socket.send(
                            JSON.stringify({
                                action: "createToastNotification",
                                arguments: {
                                    message: DOMPurify.sanitize(`Only staff members may use this command.`)
                                }
                            })
                        );
                        return;
                        break;
                    }
                    broadcastToEverySocket(
                        JSON.stringify({
                            action: "createToastNotification",
                            arguments: {
                                position: "topCenter",
                                message: DOMPurify.sanitize(
                                    `Message from ${
                                        utilities.getNameOfSocketOwner(socket) == "mistertfy64" ? "Game Master" : utilities.beautifyRankName(socket.playerRank)
                                    } ${utilities.getNameOfSocketOwner(socket)}:<br>${parsedMessage.arguments.message}`
                                )
                            }
                        })
                    );

                    socket.send(
                        JSON.stringify({
                            action: "createToastNotification",
                            arguments: {
                                message: DOMPurify.sanitize(`Sent message to all online players!`)
                            }
                        })
                    );
                }
                case "sendReport": {
                    // console.debug(`${utilities.getNameOfSocketOwner(socket)} reported ${parsedMessage.arguments.reportTarget} for this reason: ${parsedMessage.arguments.reportDescription}`)
                    let result = await moderation.sendReport(socket, parsedMessage.arguments.reportTarget, parsedMessage.arguments.reportDescription);
                    let message = "";
                    if (result) {
                        message = "Successfully sent report.";
                    } else {
                        message = "Failed to send report.";
                    }
                    socket.send(JSON.stringify({ action: "createToastNotification", arguments: { message: DOMPurify.sanitize(message) } }));
                    break;
                }
                default: {
                    break;
                }
            }
        },

        close: (socket, code, message) => {
            deleteSocket(global.sockets.find((socketToClose) => socketToClose.connectionID === socket.connectionID));
        },

        end: (socket, code, message) => {
            deleteSocket(global.sockets.find((socketToClose) => socketToClose.connectionID === socket.connectionID));
        }
    })

    .listen(WEBSOCKET_PORT, (token) => {
        console.log(log.addMetadata(`Listening to WebSockets at localhost:${WEBSOCKET_PORT}`, "info"));
    });

app.listen(PORT, () => {
    console.log(log.addMetadata(`Listening at localhost:${PORT}`, "info"));
    if (credentials.getWhetherTestingCredentialsAreUsed()) {
        console.log(log.addMetadata("WARNING: Using testing credentials.", "warn"));
    }
});
