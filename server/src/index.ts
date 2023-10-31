import { log } from "./core/log";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import uWS from "uWebSockets.js";
require("dotenv").config({ path: "../credentials/.env" });

// TODO: Combine these lines
import express from "express";
import { Request, Response } from "express";

import * as universal from "./universal";
import * as utilities from "./core/utilities";
import * as input from "./core/input";
import {
  defaultMultiplayerRoomID,
  GameMode,
  SingleplayerRoom,
  MultiplayerRoom,
  Room,
  leaveMultiplayerRoom,
  resetDefaultMultiplayerRoomID
} from "./game/Room";
import _ from "lodash";
import { authenticate } from "./authentication/authenticate";
import { User } from "./models/User";
const cors = require("cors");
const bodyParser = require("body-parser");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
const mongoDBSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");
import rateLimit from "express-rate-limit";
import { attemptToSendChatMessage } from "./core/chat";
import { validateCustomGameSettings } from "./core/utilities";
import { synchronizeGameDataWithSocket } from "./universal";
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
const app = express();
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://mathematicalbasedefenders.com",
    "https://mathematicalbasedefenders.com:3000"
  ]
};
app.use(cors(corsOptions));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": [
          "'self'",
          "code.jquery.com",
          "cdnjs.cloudflare.com",
          "cdn.jsdelivr.net",
          "pixijs.download",
          "'unsafe-eval'"
        ],
        "style-src": ["'unsafe-inline'", "*"],
        "connect-src": [
          "http://localhost:3000",
          "https://play.mathematicalbasedefenders.com:3000",
          "ws://localhost:5000",
          "wss://play.mathematicalbasedefenders.com:5000",
          "'self'"
        ]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
const jsonParser = bodyParser.json();
// get configuration
// TODO: Consider moving to universal.ts
let configurationLocation = path.join(
  __dirname,
  "..",
  "mbd-server-configuration.json"
);
const CONFIGURATION = JSON.parse(
  fs.readFileSync(configurationLocation, "utf-8")
);
const PORT: number = 4000;
const WEBSOCKET_PORT: number = 5000;
const DESIRED_SYNCHRONIZATIONS_PER_SECOND: number = 5;
const DESIRED_SERVER_UPDATES_PER_SECOND: number = 60;
const UPDATE_INTERVAL: number = 1000 / DESIRED_SERVER_UPDATES_PER_SECOND;
const SYNCHRONIZATION_INTERVAL: number =
  1000 / DESIRED_SYNCHRONIZATIONS_PER_SECOND;
let initialized = false;

let currentTime: number = Date.now();
let lastUpdateTime: number = Date.now();
let sendDataDeltaTime: number;

const DATABASE_CONNECTION_URI: string | undefined =
  process.env.DATABASE_CONNECTION_URI;

if (CONFIGURATION.useDatabase) {
  mongoose.connect(DATABASE_CONNECTION_URI as string);
}

mongoose.connection.on("connected", async () => {
  universal.STATUS.databaseAvailable = true;
  log.info(`Connected to database! Database is now available.`);
});

type WebSocketMessage = ArrayBuffer & {
  message?: string;
  messageArguments?: any;
};

uWS
  .App()
  .ws("/", {
    open: (socket: universal.GameSocket) => {
      log.info("Socket connected!");
      socket.connectionID = utilities.generateConnectionID(16);
      socket.ownerGuestName = `Guest ${utilities.generateGuestID(8)}`;
      universal.sockets.push(socket);
      log.info(`There are now ${universal.sockets.length} sockets connected.`);
      socket.subscribe("game");
      socket.send(
        JSON.stringify({
          message: "changeValueOfInput",
          selector: "#settings-screen__content--online__socket-id",
          value: socket.connectionID
        })
      );
      socket.send(
        JSON.stringify({
          message: "updateGuestInformationText",
          data: {
            guestName: socket.ownerGuestName
          }
        })
      );
    },

    message: (
      socket: universal.GameSocket,
      message: WebSocketMessage,
      isBinary: boolean
    ) => {
      const buffer = Buffer.from(message);
      const incompleteParsedMessage = JSON.parse(buffer.toString());
      if (!incompleteParsedMessage) {
        return;
      }
      const parsedMessage = incompleteParsedMessage.message;
      // FIXME: VALIDATE DATA!!!
      switch (parsedMessage.message) {
        case "startGame": {
          switch (parsedMessage.mode) {
            case "singleplayer": {
              switch (parsedMessage.modifier) {
                case "easy": {
                  const room = createSingleplayerRoom(
                    socket,
                    GameMode.EasySingleplayer
                  );
                  room.addMember(socket);
                  room.startPlay();
                  break;
                }
                case "standard": {
                  const room = createSingleplayerRoom(
                    socket,
                    GameMode.StandardSingleplayer
                  );
                  room.addMember(socket);
                  room.startPlay();
                  break;
                }
                case "custom": {
                  let validationResult = validateCustomGameSettings(
                    parsedMessage.mode,
                    JSON.parse(parsedMessage.settings)
                  );
                  if (!validationResult.success) {
                    // send error message
                    socket.send(
                      JSON.stringify({
                        message: "changeText",
                        selector:
                          "#main-content__custom-singleplayer-intermission-screen-container__errors",
                        value: validationResult.reason
                      })
                    );
                    return;
                  }
                  const room = createSingleplayerRoom(
                    socket,
                    GameMode.CustomSingleplayer,
                    JSON.parse(parsedMessage.settings)
                  );
                  room.addMember(socket);
                  room.startPlay();
                  socket.send(
                    JSON.stringify({
                      message: "changeText",
                      selector:
                        "#main-content__custom-singleplayer-intermission-screen-container__errors",
                      value: ""
                    })
                  );
                  socket.send(
                    JSON.stringify({
                      message: "changeScreen",
                      newScreen: "canvas"
                    })
                  );
                  break;
                }
                default: {
                  log.warn(
                    `Unknown singleplayer game mode: ${parsedMessage.modifier}`
                  );
                  break;
                }
              }
              break;
            }
            default: {
              log.warn(`Unknown game mode: ${parsedMessage.mode}`);
              break;
            }
          }
          break;
        }
        case "joinMultiplayerRoom": {
          switch (parsedMessage.room) {
            case "default": {
              joinMultiplayerRoom(socket, "default");
              break;
            }
            default: {
              log.warn(`Unknown multiplayer room: ${parsedMessage.room}`);
            }
          }
          break;
        }
        case "leaveMultiplayerRoom": {
          // attempt to
          leaveMultiplayerRoom(socket);
          break;
        }
        // game input
        case "keypress": {
          input.processKeypress(socket, parsedMessage.keypress);
          synchronizeGameDataWithSocket(socket);
          break;
        }
        case "emulateKeypress": {
          input.emulateKeypress(socket, parsedMessage.emulatedKeypress);
          break;
        }
        case "authenticate": {
          attemptAuthentication(
            parsedMessage.username,
            parsedMessage.password,
            parsedMessage.socketID
          );
          break;
        }
        case "sendChatMessage": {
          attemptToSendChatMessage(
            parsedMessage.scope,
            parsedMessage.chatMessage,
            socket || ""
          );
          break;
        }
        default: {
          console.warn(
            `Unknown action from socket with connectionID ${socket.connectionID}: ${parsedMessage.message}`
          );
          break;
        }
      }
    },

    close: (
      socket: universal.GameSocket,
      code: unknown,
      message: WebSocketMessage
    ) => {
      log.info(`Socket disconnected! (${code} ${message})`);
      universal.deleteSocket(socket);
      log.info(`There are now ${universal.sockets.length} sockets connected.`);
    }
  })

  .listen(WEBSOCKET_PORT, (token: string) => {
    if (token) {
      log.info(`WebSockets Server listening at port ${WEBSOCKET_PORT}`);
    } else {
      log.info(`Failed to listen to WebSockets at port ${WEBSOCKET_PORT}`);
    }
  });

function update(deltaTime: number) {
  for (let room of universal.rooms) {
    if (room) {
      room.update();
    }
  }

  // DATA IS SENT HERE. <---
  synchronizeGameDataWithSockets(deltaTime);

  // delete rooms with zero players
  // additionally, delete rooms which are empty JSON objects.
  let livingRoomCondition = (element: Room) =>
    !(
      element?.memberConnectionIDs.length +
        element?.spectatorConnectionIDs.length <=
        0 ||
      typeof element === "undefined" ||
      Object.keys(element).length === 0
    );
  let oldRooms = _.clone(universal.rooms).map((element) => element.id);
  utilities.mutatedArrayFilter(universal.rooms, livingRoomCondition);

  let newRooms = _.clone(universal.rooms).map((element) => element.id);
  let deletedRooms = oldRooms.filter((element) => !newRooms.includes(element));
  for (let room of deletedRooms) {
    log.info(`Deleted room with ID ${room}`);
    if (room === defaultMultiplayerRoomID) {
      resetDefaultMultiplayerRoomID(room);
    }
  }
}

// TODO: Move these functions somewhere else.
function synchronizeGameDataWithSockets(deltaTime: number) {
  sendDataDeltaTime += deltaTime;
  if (sendDataDeltaTime < SYNCHRONIZATION_INTERVAL) {
    return;
  }
  sendDataDeltaTime -= SYNCHRONIZATION_INTERVAL;
  for (let socket of universal.sockets) {
    synchronizeGameDataWithSocket(socket);
    universal.synchronizeMetadataWithSocket(socket, deltaTime);
  }
}

/**
 * Resets all "one-frame" variables.
 * I forgot what this actually does -mistertfy64 2023-07-28
 */
function resetOneFrameVariables() {
  let rooms = universal.rooms;
  for (let room of rooms) {
    if (!room) {
      continue;
    }
    if (room.gameData) {
      for (let gameData of room.gameData) {
        gameData.enemiesToErase = [];
        // gameData.commands = {};
      }
    }
  }
}

/**
 * Creates a new singleplayer room.
 * @param {universal.GameSocket} caller The socket that called the function
 * @param {GameMode} gameMode The singleplayer game mode.
 * @param {settings} settings The `settings` for the singleplayer game mode, if it's custom.
 * @returns The newly-created room object.
 */
function createSingleplayerRoom(
  caller: universal.GameSocket,
  gameMode: GameMode,
  settings?: { [key: string]: string }
) {
  let room = new SingleplayerRoom(caller, gameMode, settings);

  universal.rooms.push(room);
  return room;
}

function joinMultiplayerRoom(socket: universal.GameSocket, roomID: string) {
  // or create one if said one doesn't exist
  if (roomID === "default") {
    let room;
    if (
      !defaultMultiplayerRoomID ||
      typeof defaultMultiplayerRoomID !== "string"
    ) {
      room = new MultiplayerRoom(socket, GameMode.DefaultMultiplayer, true);
      room?.addMember(socket);
      universal.rooms.push(room);
    } else {
      room = universal.rooms.find(
        (room) => room.id === defaultMultiplayerRoomID
      );
      room?.addMember(socket);
    }
    // FIXME: may cause problems later
    socket.subscribe(defaultMultiplayerRoomID as string);
  }
}

const loop = setInterval(() => {
  if (!initialized) {
    initialize();
    initialized = true;
  }
  currentTime = Date.now();
  let deltaTime: number = currentTime - lastUpdateTime;
  update(deltaTime);
  lastUpdateTime = Date.now();
}, UPDATE_INTERVAL);

app.get("/", limiter, (request: Request, response: Response) => {
  response.render("pages/index.ejs");
});

// app.post(
//   "/authenticate",
//   limiter,
async function attemptAuthentication(
  username: string,
  password: string,
  socketID: string
) {
  let sanitizedUsername = mongoDBSanitize.sanitize(
    DOMPurify.sanitize(username)
  );
  log.info(`Authentication request requested for account ${sanitizedUsername}`);
  let result = await authenticate(username, password, socketID);
  let socket = universal.getSocketFromConnectionID(socketID);
  if (!result.good || !socket) {
    result.reason === "All checks passed"
      ? "Invalid Socket Connection ID"
      : result.reason;
    socket?.send(
      JSON.stringify({
        message: "createToastNotification",
        // TODO: Refactor this
        text: `Failed to log in as ${username} (${result.reason})`
      })
    );
    return false;
  }
  socket.loggedIn = true;
  socket.ownerUsername = username;
  socket.ownerUserID = result.id;
  const userData = await User.safeFindByUsername(
    socket.ownerUsername as string
  );
  utilities.updateSocketUserInformation(socket);
  socket.playerRank = utilities.getRank(userData);
  socket.send(
    JSON.stringify({
      message: "createToastNotification",
      text: `Successfully logged in as ${username}`
    })
  );

  return true;
}

function initialize() {
  sendDataDeltaTime = 0;
}

app.post(
  "/authenticate",
  jsonParser,
  async (request: Request, response: Response) => {
    const username = request.body["username"];
    const password = request.body["password"];
    const socketID = request.body["socketID"];
    const result = await attemptAuthentication(username, password, socketID);
    response.json({ success: result });
  }
);

app.listen(PORT, () => {
  log.info(`Server listening at port ${PORT}`);
  log.info(`Server is using configuration ${JSON.stringify(CONFIGURATION)}`);
  if (process.env.credentialSetUsed === "TESTING") {
    log.warn("Using testing credentials.");
  }
});
