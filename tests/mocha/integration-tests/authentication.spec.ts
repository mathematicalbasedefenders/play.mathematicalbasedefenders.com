import { describe } from "mocha";
import { authenticateForSocket } from "../../../server/src/authentication/authenticate";
import { TESTING_CONSTANTS } from "../constants";
import { wait } from "../wait";
import mongoose from "mongoose";
import assert from "node:assert";
import * as universal from "../../../server/src/universal";
import { User } from "../../../server/src/models/User";
const bcrypt = require("bcrypt");

function getConnectionIDOfSocket(messages: Array<any>) {
  const connectionIDMessage = messages.filter((message) => {
    const json = JSON.parse(message);
    return (
      json.message === "changeValueOfInput" &&
      json.selector === "#authentication-modal__socket-id"
    );
  })[0];

  const connectionID = JSON.parse(connectionIDMessage).value;
  return connectionID;
}

describe("authentication.ts", () => {
  let databaseConnection: mongoose.Mongoose;

  before(async function () {
    databaseConnection = await mongoose.connect(process.env.MONGO_URI ?? "");
    mongoose.connection.on("connected", () => {
      console.log(`Connected to test database!`);
    });
  });

  beforeEach(async function () {
    // databaseConnection = await mongoose.connect(process.env.MONGO_URI ?? "");
    // mongoose.connection.on("connected", () => {
    //   console.log(`Connected to test database!`);
    // });
    (globalThis as any).sockets = [];
    (globalThis as any).rooms = [];
    universal.STATUS.databaseAvailable = true;

    // add test user
    const user = new User();
    user.username = TESTING_CONSTANTS.TESTING_USER_USERNAME;
    user.hashedPassword = await bcrypt.hash(
      TESTING_CONSTANTS.TESTING_USER_PASSWORD,
      4
    );
    await user.save();
  });

  it("should allow logging in when given correct credentials", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket = new WebSocket(url);

    const messages: Array<any> = [];

    await new Promise((resolve) => socket.addEventListener("open", resolve));
    socket.addEventListener("message", (event: any) => {
      messages.push(event.data);
    });

    await wait(TESTING_CONSTANTS.WEBSOCKET_UPDATE_DELAY_TIME);

    const connectionID = getConnectionIDOfSocket(messages);

    const result = await authenticateForSocket(
      TESTING_CONSTANTS.TESTING_USER_USERNAME,
      TESTING_CONSTANTS.TESTING_USER_PASSWORD,
      connectionID
    );
    assert.equal(result.good, true);

    socket.close();
  });

  it("should not allow logging in when database is unavailable", async () => {
    universal.STATUS.databaseAvailable = false;

    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket = new WebSocket(url);

    const messages: Array<any> = [];

    await new Promise((resolve) => socket.addEventListener("open", resolve));
    socket.addEventListener("message", (event: any) => {
      messages.push(event.data);
    });

    await wait(TESTING_CONSTANTS.WEBSOCKET_UPDATE_DELAY_TIME);

    const connectionID = getConnectionIDOfSocket(messages);

    const result = await authenticateForSocket(
      TESTING_CONSTANTS.TESTING_USER_USERNAME,
      TESTING_CONSTANTS.TESTING_USER_PASSWORD,
      connectionID
    );
    assert.equal(result.good, false);

    socket.close();
  });

  it("should not allow logging in when given incorrect credentials", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket = new WebSocket(url);

    const messages: Array<any> = [];

    await new Promise((resolve) => socket.addEventListener("open", resolve));
    socket.addEventListener("message", (event: any) => {
      messages.push(event.data);
    });

    await wait(TESTING_CONSTANTS.WEBSOCKET_UPDATE_DELAY_TIME);

    const connectionID = getConnectionIDOfSocket(messages);

    const result = await authenticateForSocket(
      TESTING_CONSTANTS.TESTING_USER_USERNAME,
      "1234567890",
      connectionID
    );
    assert.equal(result.good, false);

    socket.close();
  });

  it("should not allow logging in when given invalid username", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket = new WebSocket(url);

    const messages: Array<any> = [];

    await new Promise((resolve) => socket.addEventListener("open", resolve));
    socket.addEventListener("message", (event: any) => {
      messages.push(event.data);
    });

    await wait(TESTING_CONSTANTS.WEBSOCKET_UPDATE_DELAY_TIME);

    const connectionID = getConnectionIDOfSocket(messages);

    const result = await authenticateForSocket(
      "MoreThanTwentyCharactersLOLha1234567",
      "1234567890",
      connectionID
    );
    assert.equal(result.good, false);

    socket.close();
  });

  it("should not allow logging in when given invalid password", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket = new WebSocket(url);

    const messages: Array<any> = [];

    await new Promise((resolve) => socket.addEventListener("open", resolve));
    socket.addEventListener("message", (event: any) => {
      messages.push(event.data);
    });

    await wait(TESTING_CONSTANTS.WEBSOCKET_UPDATE_DELAY_TIME);

    const connectionID = getConnectionIDOfSocket(messages);

    const result = await authenticateForSocket(
      TESTING_CONSTANTS.TESTING_USER_USERNAME,
      "160",
      connectionID
    );
    assert.equal(result.good, false);

    socket.close();
  });

  afterEach(async function () {
    await databaseConnection.connection.db.dropDatabase();
  });

  after(async function () {
    await databaseConnection.connection.close();
  });
});
