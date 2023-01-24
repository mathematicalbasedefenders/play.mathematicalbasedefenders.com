import { log } from "./server/core/log";
import mongoose from "mongoose";
import path from "path";
import uWS from "uWebSockets.js";
require("dotenv").config({ path: "./credentials/.env" });

// TODO: Combine these lines
import express from "express";
import { Request, Response, NextFunction } from "express";

import * as startAction from "./server/game/actions/start";
import * as global from "./server/universal";

const app = express();
app.use(express.static(path.join(__dirname, "/public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "server/views"));

const PORT: number = 3000;
const WEBSOCKET_PORT: number = 5000;
const LOOP_INTERVAL: number = 1000 / 60;

let currentTime: number;
let lastUpdateTime: number;

const DATABASE_CONNECTION_URI: string | undefined =
  process.env.DATABASE_CONNECTION_URI;

// mongoose.connect(DATABASE_CONNECTION_URI as string);

mongoose.connection.on("connected", async () => {
  log.info(`Connected to database!`);
});

type WebSocketMessage = ArrayBuffer & {
  action?: string;
  arguments?: string;
};

uWS
  .App()
  .ws("/", {
    open: (socket: global.GameSocket, request?: unknown) => {
      log.info("Socket connected!");
      global.sockets.push(socket);
      log.info(`There are now ${global.sockets.length} sockets connected.`);
      socket.subscribe("game");
    },

    message: (
      socket: global.GameSocket,
      message: WebSocketMessage,
      isBinary: boolean
    ) => {
      switch (message.action) {
        case "start": {
        }
      }
    },

    close: (
      socket: global.GameSocket,
      code: unknown,
      message: WebSocketMessage
    ) => {
      log.info("Socket disconnected!");
      global.deleteSocket(socket);
      log.info(`There are now ${global.sockets.length} sockets connected.`);
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
  let message: string = JSON.stringify({
    message: "renderGameData",
    arguments: [deltaTime, global.sockets.length]
  });
  for (let socket of global.sockets) {
    socket.send(message);
  }
}

const loop = setInterval(() => {
  currentTime = Date.now();
  let deltaTime: number = currentTime - lastUpdateTime;
  update(deltaTime);
  lastUpdateTime = Date.now();
}, LOOP_INTERVAL);

app.get("/", (request: Request, response: Response) => {
  response.render("pages/index.ejs");
});

app.listen(PORT, () => {
  log.info(`Game listening at port ${PORT}`);
  if (process.env.credentialSetUsed === "TESTING") {
    log.warn("Using testing credentials.");
  }
});
