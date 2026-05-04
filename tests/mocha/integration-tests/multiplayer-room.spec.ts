import assert from "node:assert";
import { TESTING_CONSTANTS } from "../constants";
import { User } from "../../../server/src/models/User";
import mongoose from "mongoose";
import * as universal from "../../../server/src/universal";
import { waitForWebSocketMessage } from "../utilities";
const bcrypt = require("bcrypt");

describe("MultiplayerRoom", () => {
  let databaseConnection: mongoose.Mongoose;

  beforeEach(async function () {
    databaseConnection = await mongoose.connect(process.env.MONGO_URI ?? "");
    mongoose.connection.on("connected", () => {
      console.log(`Connected to test database!`);
    });
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

  it("should create a custom multiplayer room once the message is sent", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket1 = new WebSocket(url);

    await new Promise((resolve) => socket1.addEventListener("open", resolve));

    const exitOpeningScreenMessage = {
      message: { message: "exitOpeningScreen" }
    };

    const createRoomMessage = {
      message: {
        message: "createMultiplayerRoom"
      }
    };

    socket1.send(JSON.stringify(exitOpeningScreenMessage));
    socket1.send(JSON.stringify(createRoomMessage));

    await waitForWebSocketMessage(
      socket1,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "changeScreen" &&
          data.newScreen === "customMultiplayerIntermission"
        );
      }
    );

    assert.ok((globalThis as any).rooms);
    assert.equal((globalThis as any).rooms.length, 1);

    socket1.close();
  });

  it("should allow joining custom multiplayer room once the message is sent, and the room exists", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket1 = new WebSocket(url);

    await new Promise((resolve) => socket1.addEventListener("open", resolve));

    const exitOpeningScreenMessage = {
      message: { message: "exitOpeningScreen" }
    };

    const createRoomMessage = {
      message: {
        message: "createMultiplayerRoom"
      }
    };

    socket1.send(JSON.stringify(exitOpeningScreenMessage));
    socket1.send(JSON.stringify(createRoomMessage));

    await waitForWebSocketMessage(
      socket1,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "changeScreen" &&
          data.newScreen === "customMultiplayerIntermission"
        );
      }
    );

    assert.ok((globalThis as any).rooms);
    assert.equal((globalThis as any).rooms.length, 1);

    const roomID = (globalThis as any).rooms[0].id;

    const socket2 = new WebSocket(url);
    await new Promise((resolve) => socket2.addEventListener("open", resolve));
    const joinRoomMessage = {
      message: {
        message: "joinMultiplayerRoom",
        room: roomID
      }
    };

    socket2.send(JSON.stringify(exitOpeningScreenMessage));
    socket2.send(JSON.stringify(joinRoomMessage));

    await waitForWebSocketMessage(
      socket2,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "changeScreen" &&
          data.newScreen === "customMultiplayerIntermission"
        );
      }
    );

    assert.equal((globalThis as any).rooms[0].memberConnectionIDs.length, 2);

    socket1.close();
    socket2.close();
  });

  it("should not allow joining custom multiplayer room once the message is sent, but the room doesn't exist", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket1 = new WebSocket(url);

    await new Promise((resolve) => socket1.addEventListener("open", resolve));

    const exitOpeningScreenMessage = {
      message: { message: "exitOpeningScreen" }
    };

    const createRoomMessage = {
      message: {
        message: "createMultiplayerRoom"
      }
    };

    socket1.send(JSON.stringify(exitOpeningScreenMessage));
    socket1.send(JSON.stringify(createRoomMessage));

    await waitForWebSocketMessage(
      socket1,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "changeScreen" &&
          data.newScreen === "customMultiplayerIntermission"
        );
      }
    );

    assert.ok((globalThis as any).rooms);
    assert.equal((globalThis as any).rooms.length, 1);

    const roomID = (globalThis as any).rooms[0].id;

    const socket2 = new WebSocket(url);
    await new Promise((resolve) => socket2.addEventListener("open", resolve));
    const joinRoomMessage = {
      message: {
        message: "joinMultiplayerRoom",
        room: roomID === "ABCDEFGH" ? "CCCCCCCC" : "ABCDEFGH" // guarantees room won't match existing room
      }
    };

    socket2.send(JSON.stringify(exitOpeningScreenMessage));
    socket2.send(JSON.stringify(joinRoomMessage));

    await waitForWebSocketMessage(
      socket2,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "createToastNotification" &&
          (data.text as string).indexOf("room") > -1
        );
      }
    );

    assert.equal((globalThis as any).rooms[0].memberConnectionIDs.length, 1);

    socket1.close();
    socket2.close();
  });

  it("should be able to start a multiplayer game if there are 2 or more players and the host chooses to start", async () => {
    const url = `ws://localhost:${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`;
    const socket1 = new WebSocket(url);

    await new Promise((resolve) => socket1.addEventListener("open", resolve));

    const exitOpeningScreenMessage = {
      message: { message: "exitOpeningScreen" }
    };

    const createRoomMessage = {
      message: {
        message: "createMultiplayerRoom"
      }
    };

    socket1.send(JSON.stringify(exitOpeningScreenMessage));
    socket1.send(JSON.stringify(createRoomMessage));

    await waitForWebSocketMessage(
      socket1,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "changeScreen" &&
          data.newScreen === "customMultiplayerIntermission"
        );
      }
    );

    assert.ok((globalThis as any).rooms);
    assert.equal((globalThis as any).rooms.length, 1);

    const roomID = (globalThis as any).rooms[0].id;

    const socket2 = new WebSocket(url);
    await new Promise((resolve) => socket2.addEventListener("open", resolve));
    const joinRoomMessage = {
      message: {
        message: "joinMultiplayerRoom",
        room: roomID
      }
    };

    socket2.send(JSON.stringify(exitOpeningScreenMessage));
    socket2.send(JSON.stringify(joinRoomMessage));

    await waitForWebSocketMessage(
      socket2,
      (data: { [key: string]: unknown }) => {
        return (
          data.message === "changeScreen" &&
          data.newScreen === "customMultiplayerIntermission"
        );
      }
    );

    assert.equal((globalThis as any).rooms[0].memberConnectionIDs.length, 2);

    const startGameMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: "/start"
      }
    };
    socket1.send(JSON.stringify(startGameMessage));

    await waitForWebSocketMessage(
      socket1,
      (data: { [key: string]: unknown }) => {
        return data.message === "changeScreen" && data.newScreen === "canvas";
      }
    );

    assert.equal((globalThis as any).rooms[0].playing, true);

    socket1.close();
    socket2.close();
  });

  afterEach(async function () {
    await databaseConnection.connection.db.dropDatabase();
    await databaseConnection.connection.close();
  });
});
