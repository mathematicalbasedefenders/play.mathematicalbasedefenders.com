import assert from "assert";
import mongoose from "mongoose";
import { User } from "../../../server/src/models/User";
import { TESTING_CONSTANTS } from "../constants";
import { waitForWebSocketMessage } from "../utilities";
import * as universal from "../../../server/src/universal";
import { cleanUnusedRooms } from "../../../server/src/index";
const bcrypt = require("bcrypt");

describe("DefaultMultiplayerRoom", () => {
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

  it("should be able to create a room if a default multiplayer room hasn't existed yet, and be able to leave and delete it", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket1 = new WebSocket(url);

    await new Promise((resolve) => socket1.addEventListener("open", resolve));

    const exitOpeningScreenMessage = {
      message: { message: "exitOpeningScreen" }
    };

    const joinMultiplayerRoomMessage = {
      message: {
        message: "joinDefaultMultiplayerRoom"
      }
    };

    const leaveMultiplayerRoomMessage = {
      message: {
        message: "leaveMultiplayerRoom"
      }
    };

    socket1.send(JSON.stringify(exitOpeningScreenMessage));
    socket1.send(JSON.stringify(joinMultiplayerRoomMessage));

    await waitForWebSocketMessage(
      socket1,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "acknowledge" &&
          data.acknowledgedMessage === "joinDefaultMultiplayerRoom"
        );
      }
    );

    assert.ok((globalThis as any).rooms);
    assert.equal((globalThis as any).rooms.length, 1);

    socket1.send(JSON.stringify(leaveMultiplayerRoomMessage));
    await waitForWebSocketMessage(
      socket1,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "acknowledge" &&
          data.acknowledgedMessage === "leaveMultiplayerRoom"
        );
      }
    );

    // I had to fake the timers, because
    // the game allows a grace period of around
    // 3 seconds before a room is eligible to
    // be able to deleted.
    (globalThis as any).rooms[0].ageInMilliseconds += 10000;
    cleanUnusedRooms();

    assert.equal((globalThis as any).rooms.length, 0);

    socket1.close();
  });

  it("should join the default multiplayer room if a default multiplayer room has already existed", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket1 = new WebSocket(url);

    await new Promise((resolve) => socket1.addEventListener("open", resolve));

    const exitOpeningScreenMessage = {
      message: { message: "exitOpeningScreen" }
    };

    const joinMultiplayerRoomMessage = {
      message: {
        message: "joinDefaultMultiplayerRoom",
        room: "default"
      }
    };

    const leaveMultiplayerRoomMessage = {
      message: {
        message: "leaveMultiplayerRoom"
      }
    };

    socket1.send(JSON.stringify(exitOpeningScreenMessage));
    socket1.send(JSON.stringify(joinMultiplayerRoomMessage));

    await waitForWebSocketMessage(
      socket1,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "acknowledge" &&
          data.acknowledgedMessage === "joinDefaultMultiplayerRoom"
        );
      }
    );

    const socket2 = new WebSocket(url);
    await new Promise((resolve) => socket2.addEventListener("open", resolve));
    socket2.send(JSON.stringify(exitOpeningScreenMessage));
    socket2.send(JSON.stringify(joinMultiplayerRoomMessage));

    await waitForWebSocketMessage(
      socket2,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "acknowledge" &&
          data.acknowledgedMessage === "joinDefaultMultiplayerRoom"
        );
      }
    );

    // I had to fake the timers, because
    // the game allows a grace period of around
    // 3 seconds before a room is eligible to
    // be able to deleted.
    (globalThis as any).rooms[0].ageInMilliseconds += 10000;

    assert.ok((globalThis as any).rooms);
    assert.equal((globalThis as any).rooms.length, 1);

    socket1.send(JSON.stringify(leaveMultiplayerRoomMessage));
    await waitForWebSocketMessage(
      socket1,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "acknowledge" &&
          data.acknowledgedMessage === "leaveMultiplayerRoom"
        );
      }
    );
    socket2.send(JSON.stringify(leaveMultiplayerRoomMessage));
    await waitForWebSocketMessage(
      socket2,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "acknowledge" &&
          data.acknowledgedMessage === "leaveMultiplayerRoom"
        );
      }
    );

    cleanUnusedRooms();

    assert.equal((globalThis as any).rooms.length, 0);

    socket1.close();
    socket2.close();
  });

  afterEach(async function () {
    await databaseConnection.connection.db.dropDatabase();
  });

  after(async function () {
    await databaseConnection.connection.close();
  });
});
