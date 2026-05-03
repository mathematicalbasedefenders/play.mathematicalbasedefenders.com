import { describe } from "mocha";
import { authenticate } from "../../../server/src/authentication/perform-authentication";
import { TESTING_CONSTANTS } from "../constants";
import mongoose from "mongoose";
import assert from "node:assert";
import * as universal from "../../../server/src/universal";
import { User } from "../../../server/src/models/User";
import { waitForWebSocketMessage } from "../utilities";
const bcrypt = require("bcrypt");

describe("perform-authentication.ts", async function () {
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

  describe("authenticate()", () => {
    it("should allow logging in when given correct credentials", async () => {
      const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
      const socket = new WebSocket(url);

      await new Promise((resolve) => socket.addEventListener("open", resolve));

      const data: any = await waitForWebSocketMessage(
        socket,
        (data: { [key: string]: unknown }) => {
          return (
            data.message === "changeValueOfInput" &&
            data.selector === "#authentication-modal__socket-id"
          );
        }
      );

      const connectionID = data.value;

      const result = await authenticate(
        TESTING_CONSTANTS.TESTING_USER_USERNAME,
        TESTING_CONSTANTS.TESTING_USER_PASSWORD,
        connectionID
      );
      assert.equal(result, true);

      socket.close();
    });

    it("should not allow logging in when given incorrect password", async () => {
      const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
      const socket = new WebSocket(url);

      await new Promise((resolve) => socket.addEventListener("open", resolve));

      const data: any = await waitForWebSocketMessage(
        socket,
        (data: { [key: string]: unknown }) => {
          return (
            data.message === "changeValueOfInput" &&
            data.selector === "#authentication-modal__socket-id"
          );
        }
      );

      const connectionID = data.value;

      const result = await authenticate(
        TESTING_CONSTANTS.TESTING_USER_USERNAME,
        "12345688",
        connectionID
      );
      assert.equal(result, false);
    });

    it("should not allow logging in when given invalid username", async () => {
      const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
      const socket = new WebSocket(url);

      await new Promise((resolve) => socket.addEventListener("open", resolve));

      const data: any = await waitForWebSocketMessage(
        socket,
        (data: { [key: string]: unknown }) => {
          return (
            data.message === "changeValueOfInput" &&
            data.selector === "#authentication-modal__socket-id"
          );
        }
      );

      const connectionID = data.value;

      const result = await authenticate(
        `$$`,
        TESTING_CONSTANTS.TESTING_USER_PASSWORD,
        connectionID
      );
      assert.equal(result, false);
    });

    it("should not allow logging in when given invalid password", async () => {
      const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
      const socket = new WebSocket(url);

      await new Promise((resolve) => socket.addEventListener("open", resolve));

      const data: any = await waitForWebSocketMessage(
        socket,
        (data: { [key: string]: unknown }) => {
          return (
            data.message === "changeValueOfInput" &&
            data.selector === "#authentication-modal__socket-id"
          );
        }
      );

      const connectionID = data.value;

      const result = await authenticate(
        TESTING_CONSTANTS.TESTING_USER_USERNAME,
        "123",
        connectionID
      );
      assert.equal(result, false);
    });

    it("should not allow logging in when socket has already exited opening screen", async () => {
      const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
      const socket = new WebSocket(url);

      await new Promise((resolve) => socket.addEventListener("open", resolve));

      const data: any = await waitForWebSocketMessage(
        socket,
        (data: { [key: string]: unknown }) => {
          return (
            data.message === "changeValueOfInput" &&
            data.selector === "#authentication-modal__socket-id"
          );
        }
      );
      const message = JSON.stringify({
        message: { message: "exitOpeningScreen" }
      });
      socket.send(message);
      await waitForWebSocketMessage(
        socket,
        (data: { [key: string]: unknown }) => {
          return (
            data.message === "acknowledge" &&
            data.acknowledgedMessage === "exitOpeningScreen"
          );
        }
      );

      const connectionID = data.value;

      const result = await authenticate(
        TESTING_CONSTANTS.TESTING_USER_USERNAME,
        TESTING_CONSTANTS.TESTING_USER_PASSWORD,
        connectionID
      );
      assert.equal(result, false);
    });

    it("should not allow logging in when socket id is invalid", async () => {
      const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
      const socket = new WebSocket(url);

      await new Promise((resolve) => socket.addEventListener("open", resolve));

      const result = await authenticate(
        TESTING_CONSTANTS.TESTING_USER_USERNAME,
        TESTING_CONSTANTS.TESTING_USER_PASSWORD,
        "1234512345123451"
      );
      assert.equal(result, false);
    });

    it("should disconnect an already logged in socket when another socket uses the same credentials", async () => {
      const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
      const socket1 = new WebSocket(url);

      await new Promise((resolve) => socket1.addEventListener("open", resolve));

      const data1: any = await waitForWebSocketMessage(
        socket1,
        (data: { [key: string]: unknown }) => {
          return (
            data.message === "changeValueOfInput" &&
            data.selector === "#authentication-modal__socket-id"
          );
        }
      );

      const connectionID1 = data1.value;

      const result1 = await authenticate(
        TESTING_CONSTANTS.TESTING_USER_USERNAME,
        TESTING_CONSTANTS.TESTING_USER_PASSWORD,
        connectionID1
      );

      assert.equal(result1, true);

      const socket2 = new WebSocket(url);
      await new Promise((resolve) => socket2.addEventListener("open", resolve));
      const data2: any = await waitForWebSocketMessage(
        socket2,
        (data: { [key: string]: unknown }) => {
          return (
            data.message === "changeValueOfInput" &&
            data.selector === "#authentication-modal__socket-id"
          );
        }
      );
      const connectionID2 = data2.value;
      const result2 = await authenticate(
        TESTING_CONSTANTS.TESTING_USER_USERNAME,
        TESTING_CONSTANTS.TESTING_USER_PASSWORD,
        connectionID2
      );
      assert.equal(result2, true);

      await new Promise((resolve) =>
        socket1.addEventListener("close", resolve)
      );
    });
  });

  afterEach(async function () {
    await databaseConnection.connection.db.dropDatabase();
  });

  after(async function () {
    await databaseConnection.connection.close();
  });
});
