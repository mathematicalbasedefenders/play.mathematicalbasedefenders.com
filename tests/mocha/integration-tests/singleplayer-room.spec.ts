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
    universal.STATUS.databaseAvailable = true;
  });

  beforeEach(async function () {
    // databaseConnection = await mongoose.connect(process.env.MONGO_URI ?? "");
    // mongoose.connection.on("connected", () => {
    //   console.log(`Connected to test database!`);
    // });
    (globalThis as any).sockets = [];
    (globalThis as any).rooms = [];

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

describe("CustomSingleplayerRoom", () => {
  let databaseConnection: mongoose.Mongoose;
  before(async function () {
    databaseConnection = await mongoose.connect(process.env.MONGO_URI ?? "");
    mongoose.connection.on("connected", () => {
      console.log(`Connected to test database!`);
    });
    universal.STATUS.databaseAvailable = true;
  });

  beforeEach(async function () {
    // databaseConnection = await mongoose.connect(process.env.MONGO_URI ?? "");
    // mongoose.connection.on("connected", () => {
    //   console.log(`Connected to test database!`);
    // });
    (globalThis as any).sockets = [];
    (globalThis as any).rooms = [];

    // add test user
    const user = new User();
    user.username = TESTING_CONSTANTS.TESTING_USER_USERNAME;
    user.hashedPassword = await bcrypt.hash(
      TESTING_CONSTANTS.TESTING_USER_PASSWORD,
      4
    );
    await user.save();
  });

  it("should allow creation of and start a custom singleplayer room if valid settings are given", async () => {
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
        modifier: "custom",
        settings: JSON.stringify({
          // base values
          baseHealth: 100,
          comboTime: 5000,
          enemySpeedCoefficient: 1,
          enemySpawnThreshold: 0.1,
          enemySpawnTime: 100,
          forcedEnemySpawnTime: 2500
        })
      }
    };

    socket.send(JSON.stringify(exitOpeningScreenMessage));
    socket.send(JSON.stringify(createRoomMessage));

    await waitForWebSocketMessage(
      socket,
      (data: { [key: string]: unknown }) => {
        return data.message === "changeScreen" && data.newScreen === "canvas";
      }
    );

    assert.ok((globalThis as any).rooms);
    assert.equal((globalThis as any).rooms.length, 1);

    socket.close();
  });

  it("should deny creation of and start a custom singleplayer room if invalid settings are given", async () => {
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
        modifier: "custom",
        settings: JSON.stringify({
          baseHealth: 1000000000,
          comboTime: 5000000,
          enemySpeedCoefficient: 12345,
          enemySpawnThreshold: 1.5,
          enemySpawnTime: 100,
          forcedEnemySpawnTime: 2500
        })
      }
    };

    socket.send(JSON.stringify(exitOpeningScreenMessage));
    socket.send(JSON.stringify(createRoomMessage));

    await waitForWebSocketMessage(socket, (data: { [key: string]: any }) => {
      return (
        data.message === "changeText" &&
        data.selector ===
          "#main-content__custom-singleplayer-intermission-screen-container__errors" &&
        data.value.indexOf("Value too") > -1
      );
    });

    assert.equal((globalThis as any).rooms.length, 0);

    socket.close();
  });

  it("should deny creation of and start a custom singleplayer room if invalid non-numeric settings are given", async () => {
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
        modifier: "custom",
        settings: JSON.stringify({
          baseHealth: "abcdef",
          comboTime: "ghi",
          enemySpeedCoefficient: "abcde",
          enemySpawnThreshold: "lol",
          enemySpawnTime: "lol",
          forcedEnemySpawnTime: "lol"
        })
      }
    };

    socket.send(JSON.stringify(exitOpeningScreenMessage));
    socket.send(JSON.stringify(createRoomMessage));

    await waitForWebSocketMessage(socket, (data: { [key: string]: any }) => {
      return (
        data.message === "changeText" &&
        data.selector ===
          "#main-content__custom-singleplayer-intermission-screen-container__errors" &&
        data.value.indexOf("Wrong type") > -1
      );
    });

    assert.equal((globalThis as any).rooms.length, 0);

    socket.close();
  });

  afterEach(async function () {
    await databaseConnection.connection.db.dropDatabase();
  });

  after(async function () {
    await databaseConnection.connection.close();
  });
});
