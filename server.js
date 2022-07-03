const http = require("http");
const util = require("util");
const fs = require("fs");
// express.js
const express = require("express");
const app = express();
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const uWS = require("uWebSockets.js");

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

const { StringDecoder } = require("string_decoder");
const decoder = new StringDecoder("utf8");

const defaults = require("./server/core/defaults.js");

// // socket.io
// const server = http.createServer(app);
// const { Server } = require("socket.io");
// const io = new Server(server);

// io.attachApp(uWebSocketsApp);

// other stuff
const PORT = 8080;
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

// variables
var sockets = [];
var rooms = Object.create(null);

var roomIDOfDefaultMultiplayerRoom = "";

// models
var User = require("./server/models/User.js");
var EasyModeLeaderboardsRecord = require("./server/models/EasyModeLeaderboardsRecord.js");
var StandardModeLeaderboardsRecord = require("./server/models/StandardModeLeaderboardsRecord.js");

const INDEX_FILE_CONTENT = fs.readFileSync("./index.html");

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

mongoose.connection.on("connected", async () => {
    console.log(log.addMetadata("Successfully connected to mongoose.", "info"));
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
                    selector: "#online-players",
                    text: sockets.length
                }
            })
        );

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

    for (let roomID of activeRoomIDs) {
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
                        broadcastToEverySocketInRoom(
                            roomIDOfDefaultMultiplayerRoom,
                            JSON.stringify({
                                action: "updateText",
                                arguments: {
                                    selector:
                                        "#default-multiplayer-room-status-text",
                                    text:
                                        "Game starting in " +
                                        Math.floor(timeLeft / 1000).toString() +
                                        " seconds."
                                }
                            })
                        );
                        dataSentWithoutCompression += utilities.getSizeInBytes([
                            "Game starting in " +
                                Math.floor(timeLeft / 1000).toString() +
                                " seconds."
                        ]);
                    }
                } else {
                    broadcastToEverySocketInRoom(
                        roomIDOfDefaultMultiplayerRoom,
                        JSON.stringify({
                            action: "updateText",
                            arguments: {
                                selector:
                                    "#default-multiplayer-room-status-text",
                                text: rooms[roomID].playing
                                    ? "Game in progress."
                                    : "Waiting for 2 or more players."
                            }
                        })
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
                    let connections = rooms[roomID].data.currentGame.players;
                    game.computeUpdate(rooms[roomID], deltaTime);

                    //TODO: Move this
                    sockets
                        .find(
                            (socket) =>
                                connections[socket.connectionID] != undefined
                        )
                        ?.send(
                            JSON.stringify({
                                action: "currentGameData",
                                arguments: {
                                    data: rooms[roomID].data.currentGame
                                        .players[Object.keys(connections)[0]]
                                }
                            })
                        );
                    dataSentWithoutCompression += utilities.getSizeInBytes(
                        JSON.stringify(
                            rooms[roomID].data.currentGame.players[
                                Object.keys(connections)[0]
                            ]
                        )
                    );
                    for (let enemy in rooms[roomID].data.currentGame.players[
                        Object.keys(connections)[0]
                    ]?.currentGame.enemiesOnField) {
                        if (
                            rooms[roomID].data.currentGame.players[
                                Object.keys(connections)[0]
                            ].currentGame.enemiesOnField[enemy].toDestroy
                        ) {
                            delete rooms[roomID].data.currentGame.players[
                                Object.keys(connections)[0]
                            ].currentGame.enemiesOnField[enemy];
                        }
                    }
                } else if (rooms[roomID].type == "defaultMultiplayerMode") {
                    game.computeUpdate(rooms[roomID], deltaTime);
                    let connections = rooms[roomID].data.currentGame.players;
                    if (connections) {
                        //TODO: check if other unrelated keys appear
                        for (let clientConnectionID of Object.keys(
                            connections
                        )) {
                            if (clientConnectionID) {
                                if (
                                    rooms[roomID].data.currentGame.players[
                                        clientConnectionID
                                    ]
                                ) {
                                    if (
                                        rooms[
                                            roomID
                                        ].data.currentGame.players.hasOwnProperty(
                                            clientConnectionID
                                        )
                                    ) {
                                        if (
                                            !rooms[roomID].data.currentGame
                                                .players[clientConnectionID]
                                                .currentGame.dead
                                        ) {
                                            try {
                                                sockets
                                                    .find(
                                                        (socket) =>
                                                            socket.connectionID ===
                                                            clientConnectionID
                                                    )

                                                    ?.send(
                                                        JSON.stringify({
                                                            action: "currentGameData",
                                                            arguments: {
                                                                data: constructDefaultMultiplayerGameDataObjectToSend(
                                                                    clientConnectionID
                                                                )
                                                            }
                                                        })
                                                    );
                                            } catch (error) {
                                                console.warn(
                                                    log.addMetadata(
                                                        error.stack,
                                                        "warn"
                                                    )
                                                );
                                                deleteSocket(
                                                    sockets.find(
                                                        (socket) =>
                                                            socket.connectionID ===
                                                            clientConnectionID
                                                    )
                                                );
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
                                                        clientConnectionID
                                                    ].currentGame.playerName.toString(),
                                                    rooms[roomID].data
                                                        .currentGame.players[
                                                        clientConnectionID
                                                    ].currentGame
                                                        .currentInGameTimeInMilliseconds,
                                                    rooms[roomID].data
                                                        .currentGame.players[
                                                        clientConnectionID
                                                    ].currentGame.enemiesSent
                                                ]
                                            ]);
                                            rooms[
                                                roomID
                                            ].data.currentGame.playersAlive.splice(
                                                rooms[
                                                    roomID
                                                ].data.currentGame.playersAlive.indexOf(
                                                    clientConnectionID
                                                ),
                                                1
                                            );
                                            if (clientConnectionID) {
                                                let data =
                                                    constructDefaultMultiplayerGameDataObjectToSend(
                                                        clientConnectionID
                                                    );
                                                data.currentGame.rank =
                                                    rooms[
                                                        roomID
                                                    ].data.currentGame.playersAlive.length;
                                                if (
                                                    !rooms[roomID].data
                                                        .currentGame.players[
                                                        clientConnectionID
                                                    ].currentGame.forfeited
                                                ) {
                                                    delete rooms[roomID].data
                                                        .currentGame.players[
                                                        clientConnectionID
                                                    ];
                                                    sockets
                                                        .find(
                                                            (element) =>
                                                                element.connectionID ===
                                                                clientConnectionID
                                                        )
                                                        .send(
                                                            JSON.stringify({
                                                                action: "currentGameData",
                                                                arguments: {
                                                                    data: data
                                                                }
                                                            })
                                                        );
                                                }
                                                dataSentWithoutCompression +=
                                                    utilities.getSizeInBytes(
                                                        JSON.stringify(data)
                                                    );
                                                let socketToClose =
                                                    sockets.find(
                                                        (element) =>
                                                            element.connectionID ===
                                                            clientConnectionID
                                                    );
                                                if (socketToClose) {
                                                    socketToClose.ownerOfSocketIsPlaying = false;
                                                }
                                                delete rooms[roomID].data
                                                    .currentGame.players[
                                                    clientConnectionID
                                                ];
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

                                    if (
                                        rooms[roomID].data.currentGame.players[
                                            clientConnectionID
                                        ]
                                    ) {
                                        for (let enemy in rooms[roomID].data
                                            .currentGame.players[
                                            clientConnectionID
                                        ].currentGame.enemiesOnField) {
                                            if (
                                                rooms[roomID].data.currentGame
                                                    .players[clientConnectionID]
                                                    .currentGame.enemiesOnField[
                                                    enemy
                                                ].toDestroy
                                            ) {
                                                delete rooms[roomID].data
                                                    .currentGame.players[
                                                    clientConnectionID
                                                ].currentGame.enemiesOnField[
                                                    enemy
                                                ];
                                            }
                                        }
                                    }
                                    if (
                                        Object.keys(
                                            rooms[roomID].data.currentGame
                                                .players
                                        ).length <= 1
                                    ) {
                                        if (
                                            rooms[roomID].data.currentGame
                                                .playersAlive.length == 1
                                        ) {
                                            let winnerSocket = sockets.find(
                                                (socket) =>
                                                    socket.connectionID ===
                                                    rooms[roomID].data
                                                        .currentGame
                                                        .playersAlive[0]
                                            );
                                            let data =
                                                constructDefaultMultiplayerGameDataObjectToSend(
                                                    clientConnectionID
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
                                                        winnerSocket
                                                            .connectionID
                                                    ].currentGame.playerName.toString(),
                                                    rooms[roomID].data
                                                        .currentGame.players[
                                                        winnerSocket
                                                            .connectionID
                                                    ].currentGame
                                                        .currentInGameTimeInMilliseconds,
                                                    rooms[roomID].data
                                                        .currentGame.players[
                                                        winnerSocket
                                                            .connectionID
                                                    ].currentGame.enemiesSent
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
                                                        selector:
                                                            "#last-game-ranks-content",
                                                        text: game.formatMultiplayerRoomRanks(
                                                            [
                                                                rooms[roomID]
                                                                    .data
                                                                    .currentGame
                                                                    .ranks
                                                            ]
                                                        ),
                                                        useHTML: true
                                                    }
                                                })
                                            );
                                            rooms[
                                                roomID
                                            ].data.currentGame.playersAlive = [];
                                        }

                                        rooms[
                                            roomIDOfDefaultMultiplayerRoom
                                        ].readyToStart = false;
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
                                        rooms[
                                            roomIDOfDefaultMultiplayerRoom
                                        ].playing = false;

                                        // let connections = [];
                                        // // io.sockets.adapter.rooms.get(
                                        // //     roomID
                                        // // );
                                        // for (clientConnectionID in connections) {
                                        //     let connection =
                                        //         // io.sockets.sockets.get(client);
                                        //         (connection.ownerOfSocketIsPlaying = false);
                                        // }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // TODO: Move this
            let connections = sockets.filter(
                (socket) => socket.variables.currentRoomSocketIsIn === roomID
            );
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

// SOCKET.IO CODE IS HERE

// io.on("connection", (socket) => {
//     sockets.push(socket);

//     socket.send(JSON.stringify({action:"updateText":{arguments:{selector: sockets.length,text:$5}}}));

//     socket.playerDataOfSocketOwner; // use this

//     socket.currentRoomSocketIsIn = "";
//     socket.ownerOfSocketIsPlaying = false;
//     socket.socketIsHostOfRoomItIsIn = false;
//     socket.playerRank = "";
//     socket.usernameOfSocketOwner;
//     socket.userIDOfSocketOwner;
//     socket.loggedIn = false;

//     let toBeGuestName = utilities.generateGuestName();
//     while (toBeGuestName in guests) {
//         toBeGuestName = utilities.generateGuestName();
//     }

//     socket.guestNameOfSocketOwner = toBeGuestName;
//     socket.send(JSON.stringify({action:"updateText":{arguments:{selector: socket.guestNameOfSocketOwner,text:$5}}}));

//     // socket.on("getPlayerDataAndUpdateText", (selector, ...dataToGet) => {
//     // 	socket.send(JSON.stringify({action:"updateText":{arguments:{selector: getPlayerData(socket, ...dataToGet,text:$5}}})));
//     // });

//     socket.on(
//         "getDataForUserInformationModalAndUpdateText",
//         async (nameToUse) => {
//             let name = await getPlayerData(nameToUse, "name");
//             let data = await getPlayerData(nameToUse, "userObject");

//             socket.emit(
//                 "updateText",
//                 "#user-information-modal-title",
//                 `Play data for ${name}`
//             );

//             if (!/Guest\s[0-9]{8}/gm.test(name) && !/\s+/.test(name)) {
//                 if (data) {
//                     socket.emit(
//                         "updateText",
//                         "#user-information-modal-text",
//                         `
// 			Total Experience Points: ${
//                 data.statistics.totalExperiencePoints
//             } (Level ${leveling.getLevel(
//                             data.statistics.totalExperiencePoints
//                         )}) |
// 			Easy Mode Personal Best: ${data.statistics.easyModePersonalBestScore} |
// 			Standard Mode Personal Best: ${data.statistics.standardModePersonalBestScore}
// 		`
//                     );
//                 } else {
//                     socket.emit(
//                         "updateText",
//                         "#user-information-modal-text",
//                         "Player not found."
//                     );
//                 }
//             } else {
//                 socket.emit(
//                     "updateText",
//                     "#user-information-modal-text",
//                     `
// 			This user is playing as a guest. Their scores will not be submitted unless they sign up for an account.
// 		`
//                 );
//             }
//         }
//     );

//     // disconnect
//     socket.on("disconnect", () => {
//         let roomToLeave = socket.currentRoomSocketIsIn;

//         if (
//             roomToLeave != undefined &&
//             roomToLeave == roomIDOfDefaultMultiplayerRoom &&
//             rooms[roomToLeave] !== undefined
//         ) {
//             delete rooms[roomToLeave].playersInRoom[socket.connectionID];

//             io.to(roomToLeave).emit(
//                 "defaultMultiplayerRoomAction",
//                 "updatePlayerList",
//                 room.getRoomPlayers(rooms[roomToLeave])
//             );

//             if (rooms[roomToLeave].playing) {
//                 rooms[roomToLeave].data.currentGame.players[
//                     socket.connectionID
//                 ].currentGame.dead = true;
//                 rooms[roomToLeave].data.currentGame.players[
//                     socket.connectionID
//                 ].currentGame.forfeited = true;
//             }
//         }

//         socket.leave(socket.currentRoomSocketIsIn);
//         socket.currentRoomSocketIsIn = "";
//         sockets.splice(sockets.indexOf(socket), 1);
//         guests.splice(guests.indexOf(socket.guestNameOfSocketOwner), 1);
//     });

//     // input
//     socket.on("keypress", async (code, playerTileKeybinds) => {
//         code = DOMPurify.sanitize(code);

//         playerTileKeybinds = DOMPurify.sanitize(playerTileKeybinds);
//         playerTileKeybinds = playerTileKeybinds.split(",");

//         // validation 1
//         if (utilities.checkIfVariablesAreUndefined(code, playerTileKeybinds)) {
//             return;
//         }

//         // validation 2
//         if (!Array.isArray(playerTileKeybinds)) {
//             return;
//         }

//         if (socket.currentRoomSocketIsIn != "") {
//             if (socket.ownerOfSocketIsPlaying) {
//                 if (code != "Escape") {
//                     switch (rooms[socket.currentRoomSocketIsIn].type) {
//                         case modes.SINGLEPLAYER: {
//                             if (
//                                 socket.currentRoomSocketIsIn != "" &&
//                                 socket.socketIsHostOfRoomItIsIn
//                             ) {
//                                 tiles.forceSelectTileWithTermID(
//                                     tiles.convertPressedKeyToTermID(
//                                         code,
//                                         playerTileKeybinds,
//                                         rooms[socket.currentRoomSocketIsIn],
//                                         socket
//                                     ),
//                                     rooms[socket.currentRoomSocketIsIn],
//                                     socket
//                                 );
//                             }
//                             break;
//                         }
//                         case modes.DEFAULT_MULTIPLAYER: {
//                             if (
//                                 socket.currentRoomSocketIsIn != "" &&
//                                 socket.ownerOfSocketIsPlaying
//                             ) {
//                                 tiles.forceSelectTileWithTermID(
//                                     tiles.convertPressedKeyToTermID(
//                                         code,
//                                         playerTileKeybinds,
//                                         rooms[socket.currentRoomSocketIsIn],
//                                         socket
//                                     ),
//                                     rooms[socket.currentRoomSocketIsIn],
//                                     socket
//                                 );
//                             }
//                             break;
//                         }
//                     }
//                 } else {
//                     // Escape
//                     socket.ownerOfSocketIsPlaying = false;
//                     socket.leave(socket.currentRoomSocketIsIn);
//                 }
//             }
//         }
//     });

//     // functions: main

//     /**
//      * Authenticates the user.
//      */
//     socket.on("authenticate", async (username, encodedPassword) => {
//         username = DOMPurify.sanitize(mongoDBSanitize(username));
//         console.log(log.addMetadata("Log in attempt from " + username, "info"));

//         if (!usersCurrentlyAttemptingToLogIn.includes(username)) {
//             if (/^[a-zA-Z0-9_]*$/g.test(username)) {
//                 usersCurrentlyAttemptingToLogIn.push(username);
//                 socket.playerDataOfSocketOwner = await User.findOne({
//                     username: username
//                 });

//                 if (socket.playerDataOfSocketOwner) {
//                     let result = await authentication.checkPassword(
//                         username,
//                         encodedPassword,
//                         socket
//                     );
//                     if (result) {
//                         let oldSocket = utilities.getSocketAccordingToUsername(
//                             username,
//                             sockets
//                         );
//                         if (oldSocket) {
//                             oldSocket.emit(
//                                 "showTextModal",
//                                 "Your account has been accessed from another location. If this wasn't you, consider changing your password.",
//                                 "Forced Disconnection Notice"
//                             );
//                             oldSocket.disconnect();
//                         }
//                         socket.usernameOfSocketOwner =
//                             socket.playerDataOfSocketOwner.username;
//                         socket.userIDOfSocketOwner =
//                             socket.playerDataOfSocketOwner["_id"];
//                         socket.emit("loginResult", username, true);
//                         usersCurrentlyAttemptingToLogIn.splice(
//                             usersCurrentlyAttemptingToLogIn.indexOf(username),
//                             1
//                         );
//                         socket.loggedIn = true;
//                         socket.playerRank = utilities.getPlayerRank(
//                             socket.playerDataOfSocketOwner
//                         );
//                         let playerLevel = leveling.getLevel(
//                             socket.playerDataOfSocketOwner.statistics
//                                 .totalExperiencePoints
//                         );
//                         socket.emit(
//                             "updateText",
//                             "#player-rank",
//                             utilities.beautifyRankName(
//                                 socket.playerRank,
//                                 username
//                             )
//                         );
//                         socket.emit(
//                             "updateCSS",
//                             "#player-rank",
//                             "color",
//                             utilities.formatPlayerName(
//                                 socket.playerRank,
//                                 username
//                             )
//                         );
//                         socket.send(JSON.stringify({action:"updateText":{arguments:{selector: username,text:$5}}}));
//                         (
//                             "updateText",
//                             "#secondary-top-bar-container",
//                             `Level ${playerLevel}`
//                         );

//                         console.log(
//                             log.addMetadata(
//                                 `Correct password for ${username}!`,
//                                 "info"
//                             )
//                         );
//                     } else {
//                         ("loginResult", username, false);
//                         usersCurrentlyAttemptingToLogIn.splice(
//                             usersCurrentlyAttemptingToLogIn.indexOf(username),
//                             1
//                         );
//                         console.log(
//                             log.addMetadata(
//                                 `Incorrect password for ${username}!`,
//                                 "info"
//                             )
//                         );
//                     }
//                 } else {
//                     console.log(
//                         log.addMetadata(
//                             "User " + username + " not found!",
//                             "info"
//                         )
//                     );
//                     socket.emit("loginResult", username, false);
//                     usersCurrentlyAttemptingToLogIn.splice(
//                         usersCurrentlyAttemptingToLogIn.indexOf(username),
//                         1
//                     );
//                 }
//             } else {
//                 console.log(
//                     log.addMetadata("User " + username + " not found!", "info")
//                 );
//                 socket.emit("loginResult", username, false);
//                 usersCurrentlyAttemptingToLogIn.splice(
//                     usersCurrentlyAttemptingToLogIn.indexOf(username),
//                     1
//                 );
//             }
//         } else {
//             console.log(
//                 log.addMetadata(
//                     "User " + username + " is already trying to log in!",
//                     "info"
//                 )
//             );
//             socket.emit("loginResult", username, false);
//         }
//     });

//     /**
//      * Creates a singleplayer room.
//      */
//     socket.on("createAndJoinDefaultSingleplayerRoom", async (gameMode) => {
//         if (socket.currentRoomSocketIsIn == "") {
//             if (
//                 gameMode == "easySingleplayerMode" ||
//                 gameMode == "standardSingleplayerMode"
//             ) {
//                 let roomID = undefined;
//                 while (roomID === undefined || roomID in rooms) {
//                     roomID = utilities.generateRoomID();
//                 }

//                 socket.currentRoomSocketIsIn = roomID;
//                 socket.socketIsHostOfRoomItIsIn = true;

//                 rooms[roomID] = {
//                     id: roomID,
//                     type: roomTypes.SINGLEPLAYER,
//                     host: socket,
//                     userIDOfHost: socket.userIDOfSocketOwner,
//                     playing: false,
//                     gameMode: gameMode,
//                     data: defaults.createNewDefaultSingleplayerGameData(
//                         modes.SINGLEPLAYER,
//                         roomID,
//                         gameMode,
//                         socket
//                     )
//                 };

//                 socket.join(roomID);
//                 initializeSingleplayerGame(
//                     rooms[socket.currentRoomSocketIsIn],
//                     gameMode,
//                     socket.connectionID
//                 );
//                 socket.ownerOfSocketIsPlaying = true;
//                 rooms[
//                     socket.currentRoomSocketIsIn
//                 ].data.currentGame.playersAlive = [socket.connectionID];
//                 rooms[socket.currentRoomSocketIsIn].playing = true;
//             } else {
//                 console.error(
//                     log.addMetadata(
//                         gameMode + " is not a valid Singleplayer game mode!",
//                         "error"
//                     )
//                 );
//             }
//         } else {
//             console.log(
//                 log.addMetadata("Socket is already in a room!", "info")
//             );
//         }
//     });

//     /**
//      * Creates a singleplayer room.
//      */
//     socket.on("createAndJoinCustomSingleplayerRoom", async (settings) => {
//         // sanitize data
//         settings = JSON.parse(settings);

//         if (socket.currentRoomSocketIsIn == "") {
//             let dataValidationResult =
//                 validation.performDataValidationForCustomSingleplayerMode(
//                     settings
//                 );
//             if (dataValidationResult.good) {
//                 let roomID = undefined;
//                 while (roomID === undefined || roomID in rooms) {
//                     roomID = utilities.generateRoomID();
//                 }

//                 socket.currentRoomSocketIsIn = roomID;
//                 socket.socketIsHostOfRoomItIsIn = true;

//                 rooms[roomID] = {
//                     id: roomID,
//                     type: roomTypes.SINGLEPLAYER,
//                     host: socket,
//                     userIDOfHost: socket.userIDOfSocketOwner,
//                     playing: false,
//                     gameMode: "customSingleplayerMode",
//                     data: defaults.createNewCustomSingleplayerGameData(
//                         modes.SINGLEPLAYER,
//                         roomID,
//                         "customSingleplayerMode",
//                         socket,
//                         settings
//                     )
//                 };

//                 socket.emit("changeScreen", "singleplayerGameScreen");
//                 socket.join(roomID);
//                 initializeSingleplayerGame(
//                     rooms[socket.currentRoomSocketIsIn],
//                     "customSingleplayerMode",
//                     socket.connectionID
//                 );
//                 socket.ownerOfSocketIsPlaying = true;
//                 rooms[
//                     socket.currentRoomSocketIsIn
//                 ].data.currentGame.playersAlive = [socket.connectionID];
//                 rooms[socket.currentRoomSocketIsIn].playing = true;
//             } else {
//                 let issueMessage = "Unable to start game. (";

//                 for (let problem in dataValidationResult.problems) {
//                     issueMessage += `${problem}: ${dataValidationResult.problems[problem].message}`;
//                 }

//                 issueMessage += ")";

//                 socket.emit(
//                     "updateText",
//                     "#singleplayer-screen-custom-mode-issues",
//                     issueMessage
//                 );
//             }
//         } else {
//             console.log(
//                 log.addMetadata("Socket is already in a room!", "info")
//             );
//         }
//     });

//     /**
//      * Creates or joins the default multiplayer room.
//      */
//     socket.on("joinOrCreateDefaultMultiplayerRoom", async () => {
//         if (socket.currentRoomSocketIsIn == "") {
//             if (roomIDOfDefaultMultiplayerRoom == "") {
//                 let roomID = undefined;
//                 while (roomID === undefined || roomID in rooms) {
//                     roomID = utilities.generateRoomID();
//                 }

//                 socket.currentRoomSocketIsIn = roomID;
//                 roomIDOfDefaultMultiplayerRoom = roomID;
//                 socket.socketIsHostOfRoomItIsIn = false;

//                 rooms[roomID] = {
//                     id: roomID,
//                     type: roomTypes.DEFAULT_MULTIPLAYER,
//                     playing: false,
//                     data: {},
//                     readyToStart: false,
//                     timeToStart: "",
//                     gameMode: "defaultMultiplayerMode",
//                     playersInRoom: {}
//                 };

//                 socket.join(roomID);

//                 rooms[roomID].playersInRoom[socket.connectionID] = socket;

//                 io.to(roomIDOfDefaultMultiplayerRoom).emit(
//                     "defaultMultiplayerRoomAction",
//                     "updatePlayerList",
//                     room.getRoomPlayers(rooms[roomID])
//                 );
//             } else {
//                 socket.join(roomIDOfDefaultMultiplayerRoom);
//                 socket.currentRoomSocketIsIn = roomIDOfDefaultMultiplayerRoom;
//                 rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom[socket.connectionID] =
//                     socket;

//                 io.to(roomIDOfDefaultMultiplayerRoom).emit(
//                     "defaultMultiplayerRoomAction",
//                     "updatePlayerList",
//                     room.getRoomPlayers(rooms[roomIDOfDefaultMultiplayerRoom])
//                 );
//             }
//         } else {
//             console.log(
//                 log.addMetadata("Socket is already in a room!", "info")
//             );
//         }
//     });

//     socket.on("leaveRoom", async () => {
//         let roomToLeave = socket.currentRoomSocketIsIn;

//         if (
//             roomToLeave != undefined &&
//             roomToLeave == roomIDOfDefaultMultiplayerRoom &&
//             rooms[roomToLeave] !== undefined
//         ) {
//             delete rooms[roomToLeave].playersInRoom[socket.connectionID];

//             io.to(roomToLeave).emit(
//                 "defaultMultiplayerRoomAction",
//                 "updatePlayerList",
//                 room.getRoomPlayers(rooms[roomToLeave])
//             );
//             if (rooms[roomToLeave].playing) {
//                 rooms[roomToLeave].data.currentGame.players[
//                     socket.connectionID
//                 ].currentGame.baseHealth = 0;
//                 rooms[roomToLeave].data.currentGame.players[
//                     socket.connectionID
//                 ].currentGame.forfeited = true;
//             }
//         }

//         socket.leave(socket.currentRoomSocketIsIn);
//         socket.currentRoomSocketIsIn = "";
//     });

//     socket.on("defaultMultiplayerRoomChatMessage", async (message) => {
//         message = DOMPurify.sanitize(message);
//         if (
//             socket.currentRoomSocketIsIn == roomIDOfDefaultMultiplayerRoom &&
//             message.replace(/\s/g, "").length &&
//             message.length < 255
//         ) {
//             io.to(roomIDOfDefaultMultiplayerRoom).emit(
//                 "defaultMultiplayerRoomAction",
//                 "updateChatBox",
//                 [
//                     socket.loggedIn
//                         ? socket.usernameOfSocketOwner
//                         : socket.guestNameOfSocketOwner,
//                     message,
//                     utilities.formatPlayerName(
//                         socket.playerRank,
//                         socket.usernameOfSocketOwner
//                     )
//                 ]
//             );
//         }
//     });

//     // functions: game

//     /**
//      * Processes an action.
//      */
//     socket.on("action", () => {
//         if (
//             socket.currentRoomSocketIsIn != "" &&
//             socket.socketIsHostOfRoomItIsIn
//         ) {
//             rooms[socket.currentRoomSocketIsIn].data.currentGame
//                 .actionsPerformed++;
//         }
//     });

//     /**
//      *
//      */
//     socket.on("tileClick", (slot) => {
//         slot = slot.toString();
//         slot = DOMPurify.sanitize(slot);
//         if (utilities.checkIfVariablesAreUndefined(slot)) {
//             return;
//         }
//         if (isNaN(slot)) {
//             return;
//         } else {
//             slot = parseInt(slot);
//         }
//         if (slot % 1 == 0 && slot >= 0 && slot <= 48) {
//             input.processTileClick(
//                 slot,
//                 rooms[socket.currentRoomSocketIsIn],
//                 socket
//             );
//         }
//     });

//     socket.on("sendProblem", () => {
//         evaluation.checkProblem(rooms[socket.currentRoomSocketIsIn], socket);
//     });

//     socket.on("broadcastMessageAsStaff", (message) => {
//         if (
//             socket.usernameOfSocketOwner == "mistertfy64" ||
//             socket.playerRank == playerRanks.ADMINISTRATOR ||
//             socket.playerRank == playerRanks.MODERATOR
//         ) {
//             io.emit("createToastNotification", {
//                 position: "topCenter",
//                 message: DOMPurify.sanitize(
//                     `Message from ${
//                         socket.usernameOfSocketOwner == "mistertfy64"
//                             ? "Game Master"
//                             : utilities.beautifyRankName(socket.playerRank)
//                     } ${socket.usernameOfSocketOwner}:<br>${message}`
//                 )
//             });
//             socket.emit(
//                 "sendMessageToConsole",
//                 "Successfully sent message to all online players!",
//                 "log"
//             );
//         } else {
//             socket.emit(
//                 "sendMessageToConsole",
//                 "Wow! You found an easter egg! Unfortunately this easter egg is only for staff members...",
//                 "log"
//             );
//         }
//     });
// });

// async function getCurrentPlayerData(socket, ...dataRequested) {
//     if (socket.loggedIn) {
//         let data = await User.findOne({
//             username: socket.usernameOfSocketOwner
//         });

//         // strip sensitive information
//         data.emailAddress = null;
//         data.hashedPassword = null;

//         switch (dataRequested[0]) {
//             case "name": {
//                 return socket.loggedIn
//                     ? socket.usernameOfSocketOwner
//                     : socket.guestNameOfSocketOwner;
//             }
//             case "level": {
//                 return leveling.getLevel(data.statistics.totalExperiencePoints);
//             }
//             case "userObject": {
//                 return data;
//             }
//         }
//     } else {
//         if (dataRequested[0] == "name") {
//             return socket.guestNameOfSocketOwner;
//         }
//         return null;
//     }
// }

// async function getPlayerData(name, ...dataRequested) {
//     if (!/Guest\s[0-9]{8}/gm.test(name)) {
//         let data = await User.findOne({ username: name });

//         if (data) {
//             // strip sensitive information
//             data.emailAddress = null;
//             data.hashedPassword = null;

//             switch (dataRequested[0]) {
//                 case "name": {
//                     return name;
//                 }
//                 case "level": {
//                     return leveling.getLevel(
//                         data.statistics.totalExperiencePoints
//                     );
//                 }
//                 case "userObject": {
//                     return data;
//                 }
//             }
//         } else {
//             if (dataRequested[0] == "name") {
//                 return name;
//             }
//             return null;
//         }
//     } else {
//         if (dataRequested[0] == "name") {
//             return name;
//         }
//         return null;
//     }
// }

function initializeSingleplayerGame(room, mode, player) {
    for (let i = 0; i < 49; i++) {
        room.data.currentGame.players[player].currentGame.tilesOnBoard[i] =
            new tile.Tile(
                generation.generateRandomTileTermID(room, player),
                i,
                false,
                room.data.currentGame.players[player].currentGame.tilesCreated +
                    1
            );
        room.data.currentGame.players[player].currentGame.tilesCreated++;
    }
}

function broadcastToEverySocket(toBroadcast) {
    for (let socket of sockets) {
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
    if (
        socket.variables.currentRoomSocketIsIn &&
        socket.variables.currentRoomSocketIsIn != ""
    ) {
        if (
            rooms[socket.variables.currentRoomSocketIsIn]?.data?.currentGame
                ?.players[socket.connectionID]
        ) {
            rooms[
                socket.variables.currentRoomSocketIsIn
            ].data.currentGame.players[
                socket.connectionID
            ].currentGame.forfeited = true;

            rooms[
                socket.variables.currentRoomSocketIsIn
            ].data.currentGame.players[
                socket.connectionID
            ].currentGame.dead = true;
        }
    }
    ``;
    delete rooms[roomIDOfDefaultMultiplayerRoom]?.players?.[
        socket.connectionID
    ];

    delete rooms[roomIDOfDefaultMultiplayerRoom]?.playersInRoom[
        socket.connectionID
    ];

    // delete rooms[
    //     sockets[sockets.indexOf(socket)].variables.currentRoomSocketIsIn
    // ]?.data?.currentGame?.players[socket.connectionID];
    sockets.splice(sockets.indexOf(socket), 1);
}

async function startDefaultMultiplayerGame(roomID) {
    let connections = sockets.filter(
        (socket) =>
            socket.variables.currentRoomSocketIsIn ===
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
        tiles.generateMultiplayerTileQueue()
    );
    rooms[
        roomIDOfDefaultMultiplayerRoom
    ].data.currentGame.globalTileQueues.push(
        tiles.generateMultiplayerTileQueue()
    );

    let playersAlive = [];

    for (let socket of connections) {
        socket.variables.ownerOfSocketIsPlaying = true;

        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            socket.connectionID
        ] = {};
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            socket.connectionID
        ].currentGame =
            defaults.createNewDefaultMultiplayerRoomPlayerObject(socket);

        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            socket.connectionID
        ].currentGame.mode = "defaultMultiplayerMode";
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            socket.connectionID
        ].currentGame.tilesCreated = 0;
        for (let i = 0; i < 49; i++) {
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                socket.connectionID
            ].currentGame.tilesOnBoard[i] = new tile.Tile(
                rooms[
                    roomIDOfDefaultMultiplayerRoom
                ].data.currentGame.globalTileQueues[0][i],
                i,
                false,
                rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                    socket.connectionID
                ].currentGame.tilesCreated + 1
            );
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                socket.connectionID
            ].currentGame.tilesCreated++;
        }
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            socket.connectionID
        ].currentGame.tileQueue = [];
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            socket.connectionID
        ].currentGame.tileQueue[0] = [];
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            socket.connectionID
        ].currentGame.tileQueue[1] = JSON.parse(
            JSON.stringify(
                rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame
                    .globalTileQueues[1]
            )
        );
        playersAlive.push(socket.connectionID);
    }
    rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.playersAlive =
        playersAlive;

    // io.to(roomIDOfDefaultMultiplayerRoom).emit(
    //     "defaultMultiplayerRoomAction",
    //     "switchToGameContainer"
    // );

    let players = sockets.filter(
        (socket) =>
            socket.variables.currentRoomSocketIsIn ===
            roomIDOfDefaultMultiplayerRoom
    );
    for (let player of players) {
        player.send(JSON.stringify({ action: "switchToGameContainer" }));
    }

    rooms[roomIDOfDefaultMultiplayerRoom].playing = true;
}

function constructDefaultMultiplayerGameDataObjectToSend(connection) {
    if (connection) {
        playerIndex = -1;
        let data =
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connection
            ];
        if (data?.currentGame) {
            data.currentGame.currentInGameTimeInMilliseconds =
                rooms[
                    roomIDOfDefaultMultiplayerRoom
                ].data.currentGame.currentInGameTimeInMilliseconds;
            data.currentGame.playersRemaining =
                rooms[
                    roomIDOfDefaultMultiplayerRoom
                ].data.currentGame.playersAlive.length;
            data.currentGame.opponentGameData = [];

            let allConnections = Object.keys(
                rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players
            );

            for (let opponentConnection of allConnections) {
                if (opponentConnection != connection) {
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
    }
    return {};
}

// only for use when called by method above
function constructMinifiedGameDataObjectToSend(connectionID, playerIndex) {
    let minifiedOpponentGameData = {};

    minifiedOpponentGameData.playerIndex = playerIndex;

    minifiedOpponentGameData.enemies = minifyEnemies(
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connectionID
        ].currentGame.enemiesOnField
    );

    minifiedOpponentGameData.tiles = minifyTiles(
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connectionID
        ].currentGame.tilesOnBoard
    );

    minifiedOpponentGameData.actionsPerMinute =
        (rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connectionID
        ].currentGame.actionsPerformed /
            (rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame
                .currentInGameTimeInMilliseconds /
                1000)) *
        60;

    (minifiedOpponentGameData.baseHealth =
        rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
            connectionID
        ].currentGame.baseHealth),
        (minifiedOpponentGameData.enemiesPending =
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connectionID
            ].currentGame.enemiesPending),
        (minifiedOpponentGameData.name =
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connectionID
            ].currentGame.playerName),
        (minifiedOpponentGameData.problem =
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connectionID
            ].currentGame.currentProblemAsBeautifulText),
        (minifiedOpponentGameData.nameColor = utilities.formatPlayerName(
            rooms[roomIDOfDefaultMultiplayerRoom].data.currentGame.players[
                connectionID
            ].currentGame.playerRank
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
    let socketsToBroadcastTo = sockets.filter(
        (element) => element.variables.currentRoomSocketIsIn === room
    );
    for (let socket of socketsToBroadcastTo) {
        try {
            socket.send(toBroadcast);
        } catch (error) {
            console.warn(log.addMetadata(error.stack, "warn"));
            deleteSocket(socket);
        }
    }
}

async function checkIfFileExists(file) {
    await fs.stat(file, function (error, stat) {
        if (error == null) {
            return true;
        } else if (err.code === "ENOENT") {
            return false;
        }
    });
}

async function readFile(requestURL) {
    let data = await fs.promises.readFile(`.${requestURL}`, "utf8");
    return Buffer.from(data);
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

            sockets.push(socket);

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

        message: (socket, message, isBinary) => {
            let parsedMessage = JSON.parse(decoder.write(Buffer.from(message)));
            switch (parsedMessage.action) {
                case "createAndJoinDefaultSingleplayerRoom": {
                    if (socket.variables.currentRoomSocketIsIn === "") {
                        if (
                            parsedMessage.arguments.gameMode ==
                                "easySingleplayerMode" ||
                            parsedMessage.arguments.gameMode ==
                                "standardSingleplayerMode"
                        ) {
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
                                userIDOfHost:
                                    socket.variables.userIDOfSocketOwner,
                                playing: false,
                                gameMode: parsedMessage.arguments.gameMode,
                                data: defaults.createNewDefaultSingleplayerGameData(
                                    modes.SINGLEPLAYER,
                                    roomID,
                                    parsedMessage.arguments.gameMode,
                                    socket
                                )
                            };

                            socket.subscribe(roomID);
                            initializeSingleplayerGame(
                                rooms[socket.variables.currentRoomSocketIsIn],
                                parsedMessage.arguments.gameMode,
                                socket.connectionID
                            );
                            socket.variables.ownerOfSocketIsPlaying = true;
                            rooms[
                                socket.variables.currentRoomSocketIsIn
                            ].data.currentGame.playersAlive = [
                                socket.connectionID
                            ];
                            rooms[
                                socket.variables.currentRoomSocketIsIn
                            ].playing = true;
                        } else {
                            console.error(
                                log.addMetadata(
                                    gameMode +
                                        " is not a valid Singleplayer game mode!",
                                    "error"
                                )
                            );
                        }
                    } else {
                        console.log(
                            log.addMetadata(
                                "Socket is already in a room!",
                                "info"
                            )
                        );
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
                                gameMode: "defaultMultiplayerMode",
                                playersInRoom: {}
                            };

                            socket.subscribe(roomID);

                            rooms[roomID].playersInRoom[socket.connectionID] =
                                socket;
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
                            socket.variables.currentRoomSocketIsIn =
                                roomIDOfDefaultMultiplayerRoom;
                            rooms[roomIDOfDefaultMultiplayerRoom].playersInRoom[
                                socket.connectionID
                            ] = socket;
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
                        console.log(
                            log.addMetadata(
                                "Socket is already in a room!",
                                "info"
                            )
                        );
                    }
                    break;
                }
                case "keypress": {
                    let code = parsedMessage.arguments.code;
                    let playerTileKeybinds =
                        parsedMessage.arguments.playerTileKeybinds;
                    code = DOMPurify.sanitize(code);

                    playerTileKeybinds = DOMPurify.sanitize(playerTileKeybinds);
                    playerTileKeybinds = playerTileKeybinds.split(",");

                    // validation 1
                    if (
                        utilities.checkIfVariablesAreUndefined(
                            code,
                            playerTileKeybinds
                        )
                    ) {
                        return;
                    }

                    // validation 2
                    if (!Array.isArray(playerTileKeybinds)) {
                        return;
                    }

                    if (socket.variables.currentRoomSocketIsIn != "") {
                        if (socket.variables.ownerOfSocketIsPlaying) {
                            if (code != "Escape") {
                                switch (
                                    rooms[
                                        socket.variables.currentRoomSocketIsIn
                                    ].type
                                ) {
                                    case modes.SINGLEPLAYER: {
                                        if (
                                            socket.variables
                                                .currentRoomSocketIsIn != "" &&
                                            socket.variables
                                                .socketIsHostOfRoomItIsIn
                                        ) {
                                            tiles.forceSelectTileWithTermID(
                                                tiles.convertPressedKeyToTermID(
                                                    code,
                                                    playerTileKeybinds,
                                                    rooms[
                                                        socket.variables
                                                            .currentRoomSocketIsIn
                                                    ],
                                                    socket
                                                ),
                                                rooms[
                                                    socket.variables
                                                        .currentRoomSocketIsIn
                                                ],
                                                socket
                                            );
                                        }
                                        break;
                                    }
                                    case modes.DEFAULT_MULTIPLAYER: {
                                        if (
                                            socket.variables
                                                .currentRoomSocketIsIn != "" &&
                                            socket.variables
                                                .ownerOfSocketIsPlaying
                                        ) {
                                            tiles.forceSelectTileWithTermID(
                                                tiles.convertPressedKeyToTermID(
                                                    code,
                                                    playerTileKeybinds,
                                                    rooms[
                                                        socket.variables
                                                            .currentRoomSocketIsIn
                                                    ],
                                                    socket
                                                ),
                                                rooms[
                                                    socket.variables
                                                        .currentRoomSocketIsIn
                                                ],
                                                socket
                                            );
                                        }
                                        break;
                                    }
                                }
                            } else {
                                // Escape
                                socket.variables.ownerOfSocketIsPlaying = false;
                                socket.unsubscribe(
                                    socket.variables.currentRoomSocketIsIn
                                );
                            }
                        }
                    }
                    break;
                }
                case "leaveRoom": {
                    let roomToLeave = socket.variables.currentRoomSocketIsIn;

                    if (
                        roomToLeave != undefined &&
                        roomToLeave == roomIDOfDefaultMultiplayerRoom &&
                        rooms[roomToLeave] !== undefined
                    ) {
                        broadcastToEverySocketInRoom(
                            roomToLeave,

                            JSON.stringify({
                                action: "updateText",
                                arguments: {
                                    selector:
                                        "#default-multiplayer-room-status-text",
                                    text: room.getRoomPlayers(
                                        rooms[roomToLeave]
                                    )
                                }
                            })
                        );
                        if (
                            rooms[roomToLeave].playing &&
                            rooms[roomToLeave].data.currentGame.players[
                                socket.connectionID
                            ]
                        ) {
                            rooms[roomToLeave].data.currentGame.players[
                                socket.connectionID
                            ].currentGame.baseHealth = 0;
                            rooms[roomToLeave].data.currentGame.players[
                                socket.connectionID
                            ].currentGame.forfeited = true;
                        }
                        delete rooms[roomToLeave].playersInRoom[
                            socket.connectionID
                        ];
                    } else {
                        delete rooms[roomToLeave].data.currentGame.players[
                            socket.connectionID
                        ];
                    }
                    socket.unsubscribe(socket.variables.currentRoomSocketIsIn);
                    socket.variables.currentRoomSocketIsIn = "";
                    break;
                }
                case "tileClick": {
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
                        input.processTileClick(
                            slot,
                            rooms[socket.variables.currentRoomSocketIsIn],
                            socket
                        );
                    }
                    break;
                }
                case "chatMessage": {
                    broadcastToEverySocketInRoom(
                        roomIDOfDefaultMultiplayerRoom,
                        JSON.stringify({
                            action: "addText",
                            arguments: {
                                selector: "#multiplayer-room-chat-content",
                                text: `${utilities.getNameOfSocketOwner(
                                    socket
                                )}: ${parsedMessage.arguments.message}`,
                                useHTML: true
                            }
                        })
                    );
                    break;
                }
            }
        },

        close: (socket, code, message) => {
            deleteSocket(
                sockets.find(
                    (socketToClose) =>
                        socketToClose.connectionID === socket.connectionID
                )
            );
        },

        end: (socket, code, message) => {
            deleteSocket(
                sockets.find(
                    (socketToClose) =>
                        socketToClose.connectionID === socket.connectionID
                )
            );
        }
    })

    .get("/", (response, request) => {
        response
            .writeStatus("200 OK")
            .writeHeader("Content-Type", "text/html")
            .tryEnd(INDEX_FILE_CONTENT);
    })
    .get("/public/*", async (response, request) => {
        if (!
            (checkIfFileExists(`.${request.getUrl()}`) &&
            !request.getUrl().indexOf("..") > -1
        )) {
            response.writeStatus("400 Bad Request").end("");
            return;
        }

        response
        .writeStatus("200 OK")
        .writeHeader(
            "Content-Type",
            FILE_TYPES[
                request
                    .getUrl()
                    .substring(request.getUrl().lastIndexOf(".") + 1)
            ]
        )
        .tryEnd(fs.readFileSync(`.${request.getUrl()}`));


    })
    .post("/authenticate", async (response, request) => {
        response.onAborted(() => {});
        //FIXME: Unsafe?
        let connectionID = request.getQuery("guestName");
        let username = request.getQuery("username");
        let encodedPassword = request.getQuery("password");
        connectionID = connectionID.replace(" ", "-");
        if (!/Guest-[0-9]{8}/.test(connectionID)) {
            console.warn(log.addMetadata("FORGED REQUEST DETECTED", "warn"));
            response.writeStatus("400 Bad Request").end("");
        } else {
            let socketToChangeConnectionID = sockets.find(
                (element) => element.connectionID === connectionID
            );
            if (socketToChangeConnectionID) {
                if (
                    authentication.authenticate(
                        socketToChangeConnectionID,
                        username,
                        encodedPassword,
                        sockets
                    )
                ) {
                    socketToChangeConnectionID.connectionID = username;

                    let data = await User.findOne({
                        username: username
                    });
                    socketToChangeConnectionID.variables.userIDOfSocketHolder =
                        data._id;
                    socketToChangeConnectionID.variables.playerRank =
                        utilities.getPlayerRank(data, data.username);
                    socketToChangeConnectionID.send(
                        JSON.stringify({
                            action: "updateText",
                            arguments: {
                                selector: "#player-rank",
                                text: utilities.beautifyRankName(
                                    socketToChangeConnectionID.variables
                                        .playerRank,
                                    data.username
                                )
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
                                value: utilities.formatPlayerName(
                                    data,
                                    data.username
                                )
                            }
                        })
                    );
                    response.writeStatus("200 OK").end("");
                } else {
                    response.writeStatus("400 Bad Request").end("");
                }
            } else {
                console.warn(
                    log.addMetadata("FORGED REQUEST DETECTED", "warn")
                );
                response.writeStatus("400 Bad Request").end("");
            }
        }
    })
    .listen(PORT, (token) => {
        console.log(log.addMetadata(`Listening at localhost:${PORT}`, "info"));
        if (credentials.getWhetherTestingCredentialsAreUsed()) {
            console.log(
                log.addMetadata("WARNING: Using testing credentials.", "info")
            );
        }
    });
