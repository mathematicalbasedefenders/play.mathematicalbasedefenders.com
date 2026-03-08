import { log } from "./core/log";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import uWS from "uWebSockets.js";
require("@dotenvx/dotenvx").config({ path: "../credentials/.env" });
import express from "express";
import * as universal from "./universal";
import * as utilities from "./core/utilities";
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
import { updateSystemStatus } from "./core/status-indicators";
import { MultiplayerRoom } from "./game/MultiplayerRoom";
import { DefaultMultiplayerRoom } from "./game/DefaultMultiplayerRoom";
import { UserData } from "./universal";
import { rateLimitSocket, WebSocketRateLimit } from "./core/rate-limiting";

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
        rateLimitSocket(socket);
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

      const parsedMessage = incompleteParsedMessage.message;

      if (parsedMessage.message === "exitOpeningScreen") {
        log.info(`Socket ${socketUserData.connectionID} exited open screen.`);
        socketUserData.exitedOpeningScreen = true;
        return;
      }

      if (!socketUserData.exitedOpeningScreen) {
        blockSocket(socket);
        return;
      }

      // ...
      switch (parsedMessage.message) {
        case "startGame": {
          universal.startGameForSocket(socket, parsedMessage);
          break;
        }
        case "joinDefaultMultiplayerRoom": {
          // reject message if already in room
          if (utilities.findRoomWithConnectionID(socketUserData.connectionID)) {
            socket.getUserData().sendToastNotification({
              borderColor: "#ff0000",
              text: "You're already in a room!"
            });
            return;
          }
          // actually join room
          if (!universal.getDefaultMultiplayerRoom()) {
            const room = new DefaultMultiplayerRoom(
              socket,
              GameMode.DefaultMultiplayer,
              true
            );
            setDefaultMultiplayerRoomID(room.id);
          }
          socket.getUserData().joinMultiplayerRoom("default");
          break;
        }
        case "joinMultiplayerRoom": {
          if (utilities.findRoomWithConnectionID(socketUserData.connectionID)) {
            socket.getUserData().sendToastNotification({
              borderColor: "#ff0000",
              text: "You're already in a room!"
            });
            return;
          }
          // validate
          const ROOM_CODE_REGEX = /^[A-Z0-9]{8}$/;
          const target = parsedMessage.room;
          const room = universal.rooms.find((e) => e.id === target);
          if (!ROOM_CODE_REGEX.test(target) || !room) {
            const socketID = socketUserData.connectionID;
            log.warn(`Socket ${socketID} tried to join a non-existent room.`);
            socket.getUserData().sendToastNotification({
              borderColor: "#ff0000",
              text: "That room doesn't exist!"
            });
            break;
          }
          const object = {
            message: "changeScreen",
            newScreen: "customMultiplayerIntermission"
          };
          const message = JSON.stringify(object);
          socket.getUserData().joinMultiplayerRoom(parsedMessage.room);
          socket.send(message);
          log.info(
            `Socket ${socketUserData.connectionID} joined room ${target}`
          );
          break;
        }
        case "createMultiplayerRoom": {
          // reject message if already in a room
          if (utilities.findRoomWithConnectionID(socketUserData.connectionID)) {
            socket.getUserData().sendToastNotification({
              borderColor: "#ff0000",
              text: "You're already in a room!"
            });
            log.warn(
              `Socket ${
                socketUserData.connectionID
              } is already in a room while creating another.`
            );
            return;
          }
          // actually create room
          const room = new MultiplayerRoom(socket, GameMode.CustomMultiplayer);
          socket.getUserData().joinMultiplayerRoom(room.id);
          const message = JSON.stringify({
            message: "changeScreen",
            newScreen: "customMultiplayerIntermission"
          });
          socket.send(message);
          break;
        }
        case "leaveMultiplayerRoom": {
          socket.getUserData().leaveMultiplayerRoom();
          break;
        }
        case "keypress": {
          socket.getUserData().processKeypress(parsedMessage.keypress);
          socket.getUserData().synchronizeToClientSide();
          break;
        }
        case "emulateKeypress": {
          socket.getUserData().emulateKeypress(parsedMessage.emulatedKeypress);
          socket.getUserData().synchronizeToClientSide();
          break;
        }
        case "sendChatMessage": {
          const scope = parsedMessage.scope;
          const message = parsedMessage.chatMessage;
          socket.getUserData().sendMessageToChat(message, scope);
          break;
        }
        case "getMultiplayerRoomList": {
          const object = {
            message: "updateMultiplayerRoomList",
            data: utilities.getHumanFriendlyMultiplayerRoomList()
          };
          socket.send(JSON.stringify(object));
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
    socket.getUserData().synchronizeToClientSide();
    socket
      .getUserData()
      .synchronizeMetadataToClientSide(deltaTime, systemStatus);
    // TODO: create a separate function for resetting `accumulatedMessages.`
  }
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
  socket.getUserData().sendToastNotification({
    borderColor: BORDER_COLOR,
    text: MESSAGE
  });
  socket.getUserData().forceTeardown();
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
  socket.getUserData().sendToastNotification({
    borderColor: "#ff0000",
    text: MESSAGE
  });
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
