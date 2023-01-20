import { log } from "./server/log";
import mongoose from "mongoose";
import path from "path";
import uWS from "uWebSockets.js";
require("dotenv").config({ path: "./credentials/.env" });

// TODO: Combine these lines
import express from "express";
import { Request, Response, NextFunction } from "express";

const app = express();
app.use(express.static(path.join(__dirname, "/public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "server/views"));

const PORT: number = 3000;
const WEBSOCKET_PORT: number = 5000;

const DATABASE_URI: string | undefined = process.env.DATABASE_CONNECTION_URI;

uWS
  .App()
  .ws("/", {
    open: (socket: unknown, request?: unknown) => {
      log.info("Socket connected!");
      log.debug(typeof socket);
    },

    message: (socket: unknown, message: ArrayBuffer, isBinary: boolean) => {
      log.info("Socket messaged!");
      log.debug(typeof socket);
    }
  })
  .listen(WEBSOCKET_PORT, (token: string) => {
    if (token) {
      log.info(`Listening to WebSockets at port ${WEBSOCKET_PORT}`);
    } else {
      log.info(`Failed to listen to WebSockets at port ${WEBSOCKET_PORT}`);
    }
  });

app.get("/", (request: Request, response: Response) => {
  response.render("pages/index.ejs");
});

app.listen(PORT, () => {
  log.info(`Game listening at port ${PORT}`);
  if (process.env.credentialSetUsed === "TESTING") {
    log.warn("Using testing credentials.");
  }
});
