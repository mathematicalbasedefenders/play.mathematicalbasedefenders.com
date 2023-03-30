import { log } from "./core/log";
import mongoose from "mongoose";
import path from "path";
import uWS from "uWebSockets.js";
require("dotenv").config({ path: "../credentials/.env" });

// TODO: Combine these lines
import express from "express";
import { Request, Response, NextFunction } from "express";

import * as startAction from "./game/actions/start";
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
  resetDefaultMultiplayerRoomID,
  getOpponentInformation
} from "./game/Room";

import _ from "lodash";
import { authenticate } from "./authentication/authenticate";
import { User } from "./models/User";
import { getScoresOfAllPlayers } from "./services/leaderboards";
import { crossOriginEmbedderPolicy } from "helmet";
const favicon = require("serve-favicon");
const bodyParser = require("body-parser");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
const mongoDBSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");
import rateLimit from "express-rate-limit";
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
const app = express();
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
// app.use(favicon(path.join(__dirname, "/public/assets/images/favicon.ico")));
// app.use(express.static(path.join(__dirname, "/public/")));
app.use(bodyParser.urlencoded({ extended: false }));
// app.set("view engine", "ejs");
// app.set("views", path.join(__dirname, "server/views"));

const PORT: number = 4000;
const WEBSOCKET_PORT: number = 5000;
const LOOP_INTERVAL: number = 1000 / 60;

let currentTime: number;
let lastUpdateTime: number;

const DATABASE_CONNECTION_URI: string | undefined =
  process.env.DATABASE_CONNECTION_URI;

mongoose.connect(DATABASE_CONNECTION_URI as string);

mongoose.connection.on("connected", async () => {
  log.info(`Connected to database!`);
});

type WebSocketMessage = ArrayBuffer & {
  message?: string;
  messageArguments?: any;
};

uWS
  .App()
  .ws("/", {
    open: (socket: universal.GameSocket, request?: unknown) => {
      log.info("Socket connected!");
      socket.connectionID = generateConnectionID(16);
      socket.ownerGuestName = `Guest ${generateGuestID(8)}`;
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
                  createNewSingleplayerRoom(socket, GameMode.EasySingleplayer);
                  break;
                }
                case "standard": {
                  createNewSingleplayerRoom(
                    socket,
                    GameMode.StandardSingleplayer
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
        // case "abortGame": {
        //   input.emulateKeypress(socket.connectionID, "Escape");
        //   break;
        // }
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
          input.processKeypress(socket.connectionID, parsedMessage.keypress);
          break;
        }
        case "emulateKeypress": {
          input.emulateKeypress(
            socket.connectionID,
            parsedMessage.emulatedKeypress
          );
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
        default: {
          console.warn(
            `Unknown action from socket with connectionID ${socket.connectionID}: ${parsedMessage.message}`
          );
        }
      }
    },

    close: (
      socket: universal.GameSocket,
      code: unknown,
      message: WebSocketMessage
    ) => {
      log.info("Socket disconnected!");
      universal.deleteSocket(socket);
      log.info(`There are now ${universal.sockets.length} sockets connected.`);
    }
  })

  .listen(WEBSOCKET_PORT, (token: string) => {
    if (token) {
      log.info(`Listening to WebSockets at port ${WEBSOCKET_PORT}`);
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

  // data is sent here.
  for (let socket of universal.sockets) {
    let gameData = _.cloneDeep(
      universal.getGameDataFromConnectionID(socket.connectionID as string)
    );
    if (gameData) {
      // remove some game data
      for (let enemy of gameData.enemies) {
        delete enemy.requestedValue;
      }
      // add some game data (extra information)
      // such as for multiplayer
      if (gameData.mode.indexOf("Multiplayer") > -1) {
        gameData.opponentGameData = getOpponentInformation(gameData, true);
      }
      let gameDataToSend: string = JSON.stringify(gameData);
      universal.getSocketFromConnectionID(socket.connectionID as string)?.send(
        JSON.stringify({
          message: "renderGameData",
          data: gameDataToSend
        })
      );
    }
  }

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
  resetOneFrameVariables();
  let newRooms = _.clone(universal.rooms).map((element) => element.id);
  let deletedRooms = oldRooms.filter((element) => !newRooms.includes(element));
  for (let room of deletedRooms) {
    log.info(`Deleted room with ID ${room}`);
    if (room === defaultMultiplayerRoomID) {
      resetDefaultMultiplayerRoomID(room);
    }
  }
}

function resetOneFrameVariables() {
  let rooms = universal.rooms;
  for (let room of rooms) {
    if (!room) {
      continue;
    }
    for (let gameData of room?.gameData) {
      gameData.enemiesToErase = [];
      gameData.commands = {};
    }
  }
}

function createNewSingleplayerRoom(
  socket: universal.GameSocket,
  gameMode: GameMode
) {
  let room = new SingleplayerRoom(socket.connectionID as string, gameMode);
  room.start();
  socket.subscribe(room.id);
  universal.rooms.push(room);
}

function joinMultiplayerRoom(socket: universal.GameSocket, roomID: string) {
  // or create one if said one doesn't exist
  if (roomID === "default") {
    let room;
    if (
      !defaultMultiplayerRoomID ||
      typeof defaultMultiplayerRoomID !== "string"
    ) {
      room = new MultiplayerRoom(
        socket.connectionID as string,
        GameMode.DefaultMultiplayer,
        true
      );
      universal.rooms.push(room);
    } else {
      room = universal.rooms.find(
        (room) => room.id === defaultMultiplayerRoomID
      );
      room?.addMember(socket.connectionID as string);
    }
    // FIXME: may cause problems later
    socket.subscribe(defaultMultiplayerRoomID as string);
  }
}

function generateConnectionID(length: number): string {
  let pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let current = "";
  while (
    current === "" ||
    utilities.checkIfPropertyWithValueExists(
      universal.sockets,
      "connectionID",
      current
    )
  ) {
    for (let i = 0; i < length; i++) {
      current += pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return current;
}

function generateGuestID(length: number) {
  let pool = "0123456789";
  let current = "";
  while (
    current === "" ||
    utilities.checkIfPropertyWithValueExists(
      universal.sockets,
      "ownerGuestID",
      current
    )
  ) {
    for (let i = 0; i < length; i++) {
      current += pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return current;
}

const loop = setInterval(() => {
  currentTime = Date.now();
  let deltaTime: number = currentTime - lastUpdateTime;
  update(deltaTime);
  lastUpdateTime = Date.now();
}, LOOP_INTERVAL);

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
    let reason =
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
    return;
  }
  socket.loggedIn = true;
  socket.ownerUsername = username;
  socket.ownerUserID = result.id;
  let userData = await User.safeFindByUsername(socket.ownerUsername as string);
  socket.send(
    JSON.stringify({
      message: "createToastNotification",
      text: `Successfully logged in as ${username}`
    })
  );
  socket.send(
    JSON.stringify({
      message: "updateUserInformationText",
      data: {
        username: username,
        good: true,
        userData: userData,
        rank: utilities.getRank(userData),
        experiencePoints: userData.statistics.totalExperiencePoints,
        records: {
          easy: userData.statistics.personalBestScoreOnEasySingleplayerMode,
          standard:
            userData.statistics.personalBestScoreOnStandardSingleplayerMode
        },
        // TODO: Refactor this
        reason: "All checks passed."
      }
    })
  );
  return;
}

app.listen(PORT, () => {
  log.info(`Server listening at port ${PORT}`);
  if (process.env.credentialSetUsed === "TESTING") {
    log.warn("Using testing credentials.");
  }
});
