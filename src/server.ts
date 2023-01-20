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

const PORT: number = 5000;
const WEBSOCKET_PORT: number = 6000;

const DATABASE_URI: string | undefined = process.env.DATABASE_CONNECTION_URI;

uWS
  .App()
  .ws("/", {
    open: (socket: unknown) => {
      log.info("Socket connected!");
      log.debug(typeof socket);
    }
  })
  .listen(WEBSOCKET_PORT, (token: string) => {
    log.info(`Listening to WebSockets at localhost:${WEBSOCKET_PORT}`);
  });

app.get("/", (request: Request, response: Response) => {
  response.render("pages/index.ejs");
});

app.listen(5000, () => {
  log.info(`Game listening at port ${PORT}`);
  if (process.env.credentialSetUsed === "TESTING") {
    log.warn("Using testing credentials.");
  }
});
