import { log } from "./server/global";
import mongoose from "mongoose";
require("dotenv").config({ path: "./credentials/.env" });

const express = require("express");
const app = express();

const PORT: number = 5000;
const DATABASE_URI: string | undefined = process.env.DATABASE_CONNECTION_URI;

app.listen(5000, () => {
  log.info(`Game listening at port ${PORT}`);
  if (process.env.credentialSetUsed === "TESTING") {
    log.warn("Using testing credentials.");
  }
});
