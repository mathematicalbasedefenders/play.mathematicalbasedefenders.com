import { log } from "./core/log";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import uWS from "uWebSockets.js";
require("@dotenvx/dotenvx").config({ path: "../credentials/.env" });
import express from "express";
import * as universal from "./universal";
import * as utilities from "./core/utilities";
import * as input from "./core/input";
import {
  defaultMultiplayerRoomID,
  GameMode,
  Room,
  resetDefaultMultiplayerRoomID,
  setDefaultMultiplayerRoomID
} from "./game/Room";
import _ from "lodash";
const cors = require("cors");
const helmet = require("helmet");
import { sendChatMessage } from "./core/chat";
import { updateSystemStatus } from "./core/status-indicators";
import { authenticate } from "./authentication/perform-authentication";
import { MultiplayerRoom } from "./game/MultiplayerRoom";
import { DefaultMultiplayerRoom } from "./game/DefaultMultiplayerRoom";
import { UserData } from "./universal";
import { WebSocketRateLimit } from "./core/rate-limiting";

const app = express();
app.set("trust proxy", 2);
app.use(cors());
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

// get configuration
const configurationLocation = path.join(
  __dirname,
  "..",
  "mathematical-base-defenders-server-configuration.json"
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
const LIVING_ROOM_CONDITION_GRACE_PERIOD = 3000;

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
     * This handles the open connection for a `GameWebSocket<UserData>`.
     * @param {universal.GameWebSocket<UserData>} socket The socket that was connected to.
     */
    open: (socket: universal.GameWebSocket<UserData>) => {
      log.info("Socket connected!");
      universal.initializeSocket(socket);
      universal.sockets.push(socket);
      log.info(`There are now ${universal.sockets.length} sockets connected.`);
      universal.sendInitialSocketData(socket);
    },

    message: (
      socket: universal.GameWebSocket<UserData>,
      message: WebSocketMessage
    ) => {
      const socketUserData = socket.getUserData();
      if (websocketRateLimit(socket)) {
        const MESSAGE =
          "You're going too fast! You have rate-limited and been disconnected.";
        const BORDER_COLOR = "#ff0000";
        universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);
        log.warn(
          `Rate-limited and killing socket ${socketUserData.connectionID}.`
        );
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
      if (typeof socketUserData.accumulatedMessages === "number") {
        socketUserData.accumulatedMessages++;
      }
      // ...
      const parsedMessage = incompleteParsedMessage.message;
      switch (parsedMessage.message) {
        case "startGame": {
          if (!socketUserData.exitedOpeningScreen) {
            blockSocket(socket);
            return;
          }
          universal.startGameForSocket(socket, parsedMessage);
          break;
        }
        case "joinMultiplayerRoom": {
          if (!socketUserData.exitedOpeningScreen) {
            blockSocket(socket);
            return;
          }
          // reject message if already in room
          if (utilities.findRoomWithConnectionID(socketUserData.connectionID)) {
            const MESSAGE = "You're already in a room!";
            const BORDER_COLOR = "#ff0000";
            universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);
            return;
          }
          // actually join room
          if (parsedMessage.room === "default") {
            if (!defaultMultiplayerRoomID) {
              const room = new DefaultMultiplayerRoom(
                socket,
                GameMode.DefaultMultiplayer,
                true
              );
              setDefaultMultiplayerRoomID(room.id);
            }
            joinMultiplayerRoom(socket, defaultMultiplayerRoomID as string);
            break;
          } else {
            // validate
            const target = parsedMessage.room;
            if (!/^[A-Z0-9]{8}$/.test(target)) {
              const socketID = socketUserData.connectionID;
              log.warn(`Socket ${socketID} used an invalid room code.`);
              const MESSAGE = "Invalid room code format!";
              const BORDER_COLOR = "#ff0000";
              universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);
              break;
            }
            const room = universal.rooms.find((e) => e.id === target);
            if (!room) {
              const socketID = socketUserData.connectionID;
              log.warn(`Socket ${socketID} tried to join a non-existent room.`);
              const MESSAGE = "That room doesn't exist!";
              const BORDER_COLOR = "#ff0000";
              universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);
              break;
            }
            const object = {
              message: "changeScreen",
              newScreen: "customMultiplayerIntermission"
            };
            const message = JSON.stringify(object);
            joinMultiplayerRoom(socket, parsedMessage.room);
            socket.send(message);
            log.info(
              `Socket ${socketUserData.connectionID} joined room ${target}`
            );
          }
          break;
        }
        case "createMultiplayerRoom": {
          if (!socketUserData.exitedOpeningScreen) {
            blockSocket(socket);
            return;
          }
          // reject message if already in room
          if (utilities.findRoomWithConnectionID(socketUserData.connectionID)) {
            const MESSAGE = "You're already in a room!";
            const BORDER_COLOR = "#ff0000";
            universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);
            log.warn(
              `Socket ${
                socketUserData.connectionID
              } is already in a room while creating another.`
            );
            return;
          }
          // actually create room
          const room = new MultiplayerRoom(socket, GameMode.CustomMultiplayer);
          joinMultiplayerRoom(socket, room.id);
          const object = {
            message: "changeScreen",
            newScreen: "customMultiplayerIntermission"
          };
          const message = JSON.stringify(object);
          socket.send(message);
          break;
        }
        case "leaveMultiplayerRoom": {
          if (!socketUserData.exitedOpeningScreen) {
            blockSocket(socket);
            return;
          }
          // attempt to
          input.leaveMultiplayerRoom(socket);
          break;
        }
        // game input
        case "keypress": {
          if (!socketUserData.exitedOpeningScreen) {
            blockSocket(socket);
            return;
          }
          input.processKeypress(socket, parsedMessage.keypress);
          universal.synchronizeGameDataWithSocket(socket);
          break;
        }
        case "emulateKeypress": {
          if (!socketUserData.exitedOpeningScreen) {
            blockSocket(socket);
            return;
          }
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
          if (!socketUserData.exitedOpeningScreen) {
            blockSocket(socket);
            return;
          }
          const scope = parsedMessage.scope;
          const message = parsedMessage.chatMessage;
          // attempt to
          sendChatMessage(scope, message, socket);
          break;
        }
        case "getMultiplayerRoomList": {
          const result = utilities.getHumanFriendlyMultiplayerRoomList();
          const object = {
            message: "updateMultiplayerRoomList",
            data: result
          };
          const message = JSON.stringify(object);
          socket.send(message);
          break;
        }
        case "exitOpeningScreen": {
          log.info(
            `Socket ${socketUserData.connectionID} exited opening screen.`
          );
          socketUserData.exitedOpeningScreen = true;
          break;
        }
        default: {
          log.warn(
            `Unknown action from socket with connectionID ${
              socketUserData.connectionID
            }: ${parsedMessage.message}`
          );
          break;
        }
      }
    },

    close: (socket: universal.GameWebSocket<UserData>) => {
      const socketUserData = socket.getUserData();
      socket.getUserData().teardown();
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

  /**
   * Rooms are deleted here!
   */
  // delete rooms with zero players
  // additionally, delete rooms which are empty JSON objects.
  let livingRoomCondition = (element: Room) =>
    !(
      element?.memberConnectionIDs.length +
        element?.spectatorConnectionIDs.length <=
        0 ||
      typeof element === "undefined" ||
      Object.keys(element).length === 0
    ) ||
    (element &&
      element.ageInMilliseconds <= LIVING_ROOM_CONDITION_GRACE_PERIOD);
  let oldRooms = _.clone(universal.rooms).map((element) => element.id);
  utilities.mutatedArrayFilter(universal.rooms, livingRoomCondition);

  let newRooms = _.clone(universal.rooms).map((element) => element.id);
  let deletedRooms = oldRooms.filter((element) => !newRooms.includes(element));
  for (let room of deletedRooms) {
    log.info(`Deleted room with ID ${room} from living condition.`);
    if (room === defaultMultiplayerRoomID) {
      resetDefaultMultiplayerRoomID(room);
    }
  }
}

// TODO: Move these functions somewhere else
/**
 * Synchronizes a socket's game data from the server
 * to the socket in the client side.
 * @param deltaTime How much time to pass (in milliseconds).
 * @param systemStatus The system status (RAM, updateTime).
 */
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
    universal.synchronizeGameDataWithSocket(socket);
    universal.synchronizeMetadataWithSocket(socket, deltaTime, systemStatus);
    // TODO: create a separate function for resetting `accumulatedMessages.`
  }
}

/**
 * Makes `socket` join a multiplayer room with the id `roomID`.
 * @param {universal.GameWebSocket<UserData>} socket
 * @param {string} roomID
 */
function joinMultiplayerRoom(
  socket: universal.GameWebSocket<UserData>,
  roomID: string
) {
  let room;
  if (roomID === "default") {
    // log.warn(`Unknown roomID, should be default: ${roomID}`);
    const defaultRoom = (room: Room) => room.id === defaultMultiplayerRoomID;
    room = universal.rooms.find(defaultRoom);
  } else {
    const roomWithID = (room: Room) => room.id === roomID;
    room = universal.rooms.find(roomWithID);
  }
  if (!room) {
    const socketUserData = socket.getUserData();
    const MESSAGE = "The room you're trying to join doesn't exist!";
    const BORDER_COLOR = "#ff0000";
    universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);
    log.warn(
      `Socket ${
        socketUserData.connectionID
      } tried to join a non-existent multiplayer room.`
    );
    return;
  }
  socket.subscribe(roomID);
  room.addMember(socket);
}

setInterval(() => {
  if (!initialized) {
    initialize();
    initialized = true;
  }
  currentTime = Date.now();
  const deltaTime: number = currentTime - lastUpdateTime;
  update(deltaTime);
  lastUpdateTime = Date.now();
}, UPDATE_INTERVAL);

function checkBufferSize(
  buffer: Buffer,
  socket: universal.GameWebSocket<UserData>
) {
  // check if buffer big, if so, log it.
  if (buffer.length >= 1024) {
    log.warn(`Buffer length of size ${buffer.length} sent to server.`);
  }
  // check if buffer too big, if so, alert socket and instantly disconnect.
  if (buffer.length <= 2048) {
    return true;
  }
  const connectionID = socket.getUserData().connectionID;
  log.warn(
    `Disconnecting socket ID ${connectionID} due to sending a large buffer.`
  );
  const MESSAGE =
    "You're sending a very large message! You have been immediately disconnected.";
  const BORDER_COLOR = "#ff0000";
  universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);
  universal.forceDeleteAndCloseSocket(socket);
  return false;
}

function initialize() {
  sendDataDeltaTime = 0;
}

/**
 * Blocks a socket from performing any actions.
 * Used when socket hasn't properly exited opening screen.
 * (e.g. using DevTools to remove opening screen)
 * @param {universal.GameWebSocket<UserData>} socket The socket to block
 */
function blockSocket(socket: universal.GameWebSocket<UserData>) {
  const socketUserData = socket.getUserData();
  log.warn(
    `Blocking socket ${
      socketUserData.connectionID
    } from improper opening screen exit.`
  );
  const MESSAGE = `Socket blocked. Please refresh and properly exit the opening screen.`;
  const BORDER_COLOR = "#ff0000";
  universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);
}

fs.readdirSync(path.join(__dirname, "./routes")).forEach((file: string) => {
  app.use(require(`./routes/${file}`).router);
});

app.listen(PORT, () => {
  log.info(
    `Mathematical Base Defenders ${universal.STATUS.gameVersion} (server-side code)`
  );
  log.info(`Server listening at port ${PORT}`);
  log.info(`Server is using configuration ${JSON.stringify(CONFIGURATION)}`);
  if (process.env.CREDENTIAL_SET_USED === "TESTING") {
    log.warn("Using testing credentials.");
  }
  if (
    process.env.NODE_ENV !== "production" &&
    CONFIGURATION.useTestingStatesIfDevelopmentEnvironment
  ) {
    log.warn("Using testing values. Turn this off in production.");
  }
});
