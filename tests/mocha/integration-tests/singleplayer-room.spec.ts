import assert from "node:assert";
import { TESTING_CONSTANTS } from "../constants";
import { User } from "../../../server/src/models/User";
import mongoose from "mongoose";
import * as universal from "../../../server/src/universal";
import { waitForWebSocketMessage } from "../utilities";
import sinon from "sinon";
const bcrypt = require("bcrypt");

describe("SingleplayerRoom", () => {
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

  it("should create a easy singleplayer room once the constructor is called", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket = new WebSocket(url);

    await new Promise((resolve) => socket.addEventListener("open", resolve));

    const exitOpeningScreenMessage = {
      message: { message: "exitOpeningScreen" }
    };

    const createRoomMessage = {
      message: { message: "startGame", mode: "singleplayer", modifier: "easy" }
    };

    socket.send(JSON.stringify(exitOpeningScreenMessage));
    socket.send(JSON.stringify(createRoomMessage));

    await waitForWebSocketMessage(
      socket,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "acknowledge" &&
          data.acknowledgedMessage === "startGame"
        );
      }
    );

    assert.ok((globalThis as any).rooms);
    assert.equal((globalThis as any).rooms.length, 1);

    socket.close();
  });

  it("should create a standard singleplayer room once the constructor is called", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket = new WebSocket(url);

    await new Promise((resolve) => socket.addEventListener("open", resolve));

    const exitOpeningScreenMessage = {
      message: { message: "exitOpeningScreen" }
    };

    const createRoomMessage = {
      message: {
        message: "startGame",
        mode: "singleplayer",
        modifier: "standard"
      }
    };

    socket.send(JSON.stringify(exitOpeningScreenMessage));
    socket.send(JSON.stringify(createRoomMessage));

    await waitForWebSocketMessage(
      socket,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "acknowledge" &&
          data.acknowledgedMessage === "startGame"
        );
      }
    );

    assert.ok((globalThis as any).rooms);
    assert.equal((globalThis as any).rooms.length, 1);

    socket.close();
  });

  it("should be able to update a playing singleplayer room's status", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket = new WebSocket(url);

    await new Promise((resolve) => socket.addEventListener("open", resolve));

    const exitOpeningScreenMessage = {
      message: { message: "exitOpeningScreen" }
    };

    const createRoomMessage = {
      message: {
        message: "startGame",
        mode: "singleplayer",
        modifier: "standard"
      }
    };

    socket.send(JSON.stringify(exitOpeningScreenMessage));
    socket.send(JSON.stringify(createRoomMessage));

    await waitForWebSocketMessage(
      socket,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "acknowledge" &&
          data.acknowledgedMessage === "startGame"
        );
      }
    );

    assert.ok((globalThis as any).rooms);
    assert.equal((globalThis as any).rooms.length, 1);

    const clock = sinon.useFakeTimers(new Date().getTime());
    for (let iterations = 0; iterations < 240; iterations++) {
      if ((globalThis as any).rooms.length === 0) {
        break;
      }
      (globalThis as any).rooms[0].update();
      clock.tick(1000);
    }
    clock.restore();

    socket.close();
  });

  afterEach(async function () {
    await databaseConnection.connection.db.dropDatabase();
  });

  after(async function () {
    await databaseConnection.connection.close();
  });
});
