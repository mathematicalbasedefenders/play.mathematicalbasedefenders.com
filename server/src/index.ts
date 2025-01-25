import { log } from "./core/log";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import uWS from "uWebSockets.js";
require("dotenv").config({ path: "../credentials/.env" });
import express, { Request, Response } from "express";
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
import { authenticateForSocket } from "./authentication/authenticate";
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
import { sendChatMessage } from "./core/chat";

import { synchronizeGameDataWithSocket } from "./universal";
import { updateSystemStatus } from "./core/status-indicators";
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
const configurationLocation = path.join(
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

// https://github.com/uNetworking/uWebSockets.js/issues/335#issuecomment-643500581
// https://github.com/uNetworking/uWebSockets.js/issues/335#issuecomment-834141711
const WebSocketRateLimit = (limit: number, interval: number) => {
  let now = 0;
  // const last = Symbol() as unknown as string;
  // const count = Symbol() as unknown as string;
  setInterval(() => ++now, interval);
  return (webSocket: universal.GameSocket) => {
    if (!webSocket.rateLimiting) {
      return;
    }
    if (webSocket.rateLimiting.last != now) {
      webSocket.rateLimiting.last = now;
      webSocket.rateLimiting.count = 1;
    } else {
      return ++webSocket.rateLimiting.count > limit;
    }
  };
};

const websocketRateLimit = WebSocketRateLimit(2500, 1000);

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
    /**
     * This handles the open connection for a `GameSocket`.
     * @param {universal.GameSocket} socket The socket that was connected to.
     */
    open: (socket: universal.GameSocket) => {
      log.info("Socket connected!");
      universal.initializeSocket(socket);
      universal.sockets.push(socket);
      log.info(`There are now ${universal.sockets.length} sockets connected.`);
      universal.sendInitialSocketData(socket);
    },

    message: (
      socket: universal.GameSocket,
      message: WebSocketMessage,
      isBinary: boolean
    ) => {
      if (websocketRateLimit(socket)) {
        const MESSAGE =
          "You're going too fast! You have rate-limited and been disconnected.";
        const COLOR = "#ff0000";
        universal.sendToastMessageToSocket(socket, MESSAGE, COLOR);
        log.warn(`Rate-limited and killing socket ${socket.connectionID}.`);
        universal.forceDeleteAndCloseSocket(socket);
        return;
      }
      const buffer = Buffer.from(message);
      const incompleteParsedMessage = JSON.parse(buffer.toString());
      if (!incompleteParsedMessage) {
        return;
      }
      if (!checkBufferSize(buffer, socket)) {
        return;
      }
      // increment accumulated messages of socket this time interval.
      if (typeof socket.accumulatedMessages === "number") {
        socket.accumulatedMessages++;
      }
      // ...
      const parsedMessage = incompleteParsedMessage.message;
      switch (parsedMessage.message) {
        case "startGame": {
          universal.startGameForSocket(socket, parsedMessage);
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
          const username = parsedMessage.username;
          const password = parsedMessage.password;
          const socketID = parsedMessage.socketID;
          // attempt to
          authenticate(username, password, socketID);
          break;
        }
        case "sendChatMessage": {
          const scope = parsedMessage.scope;
          const message = parsedMessage.chatMessage;
          // attempt to
          sendChatMessage(scope, message, socket);
          break;
        }
        case "exitOpeningScreen": {
          log.info(`Socket ${socket.connectionID} exited opening screen.`);
          socket.exitedOpeningScreen = true;
        }
        default: {
          console.warn(
            `Unknown action from socket with connectionID ${socket.connectionID}: ${parsedMessage.message}`
          );
          break;
        }
      }
    },

    close: (socket: universal.GameSocket) => {
      log.info(`Socket with ID ${socket.connectionID} has disconnected!`);
      universal.deleteSocket(socket);
      log.info(`There are now ${universal.sockets.length} sockets connected.`);
    }
  })

  .listen(WEBSOCKET_PORT, (token) => {
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

  // CHECK FOR BAD SOCKETS
  utilities.checkWebSocketMessageSpeeds(universal.sockets, deltaTime);
  // DATA IS SENT HERE. <---
  const systemStatus = updateSystemStatus(deltaTime);
  synchronizeGameDataWithSockets(deltaTime, systemStatus || {});

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

// TODO: Move these functions somewhere else
function synchronizeGameDataWithSockets(
  deltaTime: number,
  systemStatus: { [key: string]: unknown }
) {
  sendDataDeltaTime += deltaTime;
  if (sendDataDeltaTime < SYNCHRONIZATION_INTERVAL) {
    return;
  }
  sendDataDeltaTime -= SYNCHRONIZATION_INTERVAL;
  for (let socket of universal.sockets) {
    synchronizeGameDataWithSocket(socket);
    universal.synchronizeMetadataWithSocket(socket, deltaTime, systemStatus);
    // TODO: create a separate function for resetting `accumulatedMessages.`
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

function joinMultiplayerRoom(socket: universal.GameSocket, roomID: string) {
  // or create one if said one doesn't exist
  if (roomID !== "default") {
    log.warn(`Unknown roomID, should be default: ${roomID}`);
  }
  let room;
  if (!defaultMultiplayerRoomID) {
    room = new MultiplayerRoom(socket, GameMode.DefaultMultiplayer, true);
    universal.rooms.push(room);
    socket.subscribe(room.id);
  } else {
    const defaultRoom = (room: Room) => room.id === defaultMultiplayerRoomID;
    room = universal.rooms.find(defaultRoom);
    socket.subscribe(defaultMultiplayerRoomID);
  }
  room?.addMember(socket);
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

async function authenticate(
  username: string,
  password: string,
  socketID: string
) {
  const htmlSanitizedUsername = DOMPurify.sanitize(username);
  const sanitizedUsername = mongoDBSanitize.sanitize(htmlSanitizedUsername);
  log.info(`Authentication request requested for account ${sanitizedUsername}`);

  /** Authenticate. */
  const result = await authenticateForSocket(username, password, socketID);
  const socket = universal.getSocketFromConnectionID(socketID);

  /** If can't find socket or socket connection ID is invalid. */
  if (!socket) {
    result.reason = `Invalid Socket Connection ID: ${socketID}`;
    log.warn(`Login attempt for ${username} failed: ${result.reason}`);
    return false;
  }

  /** If failed to log in for other reason. */
  if (!result.good) {
    log.warn(`Login attempt for ${username} failed: ${result.reason}`);
    const MESSAGE = `Failed to login as ${username} (${result.reason})`;
    const BORDER_COLOR = "#ff0000";
    universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);
    return false;
  }

  /** Successfully logged in. */
  socket.loggedIn = true;
  socket.ownerUsername = username;
  socket.ownerUserID = result.id;
  const userData = await User.safeFindByUsername(socket.ownerUsername);
  utilities.updateSocketUserInformation(socket);
  socket.playerRank = utilities.getRank(userData);
  const MESSAGE = `Successfully logged in as ${username}`;
  const COLOR = "#1fa628";
  universal.sendToastMessageToSocket(socket, MESSAGE, COLOR);

  /** Send data. */
  const statistics = userData.statistics;
  socket.send(
    JSON.stringify({
      message: "updateUserInformationText",
      data: {
        username: username,
        good: true,
        userData: userData,
        rank: utilities.getRank(userData),
        experiencePoints: statistics.totalExperiencePoints,
        records: {
          easy: statistics.personalBestScoreOnEasySingleplayerMode,
          standard: statistics.personalBestScoreOnStandardSingleplayerMode
        },
        reason: "All checks passed."
      }
    })
  );

  // Also add missing keys
  if (socket.ownerUserID) {
    User.addMissingKeys(socket.ownerUserID);
  }
  return true;
}

function checkBufferSize(buffer: Buffer, socket: universal.GameSocket) {
  // check if buffer too big, if so, alert socket and instantly disconnect.
  if (buffer.length <= 2048) {
    return true;
  }
  const connectionID = socket.connectionID;
  log.warn(
    `Disconnecting socket ID ${connectionID} due to sending a large buffer.`
  );
  const MESSAGE =
    "You're sending a very large message! You have been immediately disconnected.";
  const COLOR = "#ff0000";
  universal.sendToastMessageToSocket(socket, MESSAGE, COLOR);
  universal.forceDeleteAndCloseSocket(socket);
  return false;
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
    const result = await authenticate(username, password, socketID);
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
