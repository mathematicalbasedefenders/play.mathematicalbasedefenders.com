import assert from "node:assert";
import { TESTING_CONSTANTS } from "../constants";
import { User } from "../../../server/src/models/User";
import mongoose from "mongoose";
import * as universal from "../../../server/src/universal";
import { waitForWebSocketMessage } from "../utilities";
import sinon from "sinon";
const bcrypt = require("bcrypt");

describe("MultiplayerRoom", () => {
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

  it("should be able to update a non-playing custom multiplayer room's status", async () => {
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
    (globalThis as any).rooms[0].update();

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

    // socket1 because the creator is the host.
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

  it("should refuse to start a multiplayer game if the host is not the one running the command", async () => {
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
    socket2.send(JSON.stringify(startGameMessage));
    await waitForWebSocketMessage(socket2, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("Unable to run /start") > -1
      );
    });

    assert.equal((globalThis as any).rooms[0].playing, false);

    socket1.close();
    socket2.close();
  });

  it("should refuse to start a multiplayer game if there are less than 2 players", async () => {
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

    const startGameMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: "/start"
      }
    };
    socket1.send(JSON.stringify(startGameMessage));
    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("Unable to run /start") > -1
      );
    });

    socket1.close();
  });

  it("should be able to update a playing custom multiplayer room's status", async () => {
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

    // socket1 because the creator is the host.
    socket1.send(JSON.stringify(startGameMessage));

    await waitForWebSocketMessage(
      socket1,
      (data: { [key: string]: unknown }) => {
        return data.message === "changeScreen" && data.newScreen === "canvas";
      }
    );

    assert.equal((globalThis as any).rooms[0].playing, true);

    const clock = sinon.useFakeTimers(new Date().getTime());
    for (let iterations = 0; iterations < 240; iterations++) {
      (globalThis as any).rooms[0].update();
      clock.tick(1000);
    }
    clock.restore();

    socket1.close();
    socket2.close();
  });

  it("should be able to run the /set command in a multiplayer room, if the host runs it", async () => {
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

    const setCommandMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: "/set comboTime 1234"
      }
    };

    // socket1 because the creator is the host.
    socket1.send(JSON.stringify(setCommandMessage));

    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("Successfully set room's constant property") >
          -1
      );
    });

    assert.equal((globalThis as any).rooms[0].customSettings.comboTime, 1234);

    socket1.close();
  });

  it("should be able to run the /get command in a multiplayer room", async () => {
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

    const getCommandMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: "/get comboTime"
      }
    };

    // socket1 because the creator is the host.
    socket1.send(JSON.stringify(getCommandMessage));

    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("The constant property") > -1
      );
    });

    socket1.close();
  });

  it("should be able to run the /setvisibility command in a multiplayer room, if the host runs it", async () => {
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

    const privatizeRoomMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: "/setvisibility false"
      }
    };

    // socket1 because the creator is the host.
    socket1.send(JSON.stringify(privatizeRoomMessage));

    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("false") > -1
      );
    });

    assert.equal((globalThis as any).rooms[0].hidden, true);

    const publicizeRoomMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: "/setvisibility true"
      }
    };

    // socket1 because the creator is the host.
    socket1.send(JSON.stringify(publicizeRoomMessage));

    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("true") > -1
      );
    });

    assert.equal((globalThis as any).rooms[0].hidden, false);

    socket1.close();
  });

  it("should be able to run the /getvisibility command in a multiplayer room", async () => {
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

    const queryRoomMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: "/getvisibility"
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

    const privatizeRoomMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: "/setvisibility false"
      }
    };

    // socket1 because the creator is the host.
    socket1.send(JSON.stringify(privatizeRoomMessage));

    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("false") > -1
      );
    });

    socket1.send(JSON.stringify(queryRoomMessage));

    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("hidden") > -1
      );
    });

    assert.equal((globalThis as any).rooms[0].hidden, true);

    const publicizeRoomMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: "/setvisibility true"
      }
    };

    // socket1 because the creator is the host.
    socket1.send(JSON.stringify(publicizeRoomMessage));

    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("true") > -1
      );
    });

    socket1.send(JSON.stringify(queryRoomMessage));

    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("public") > -1
      );
    });

    assert.equal((globalThis as any).rooms[0].hidden, false);

    socket1.close();
  });

  it("should be able to run the /kick command in a multiplayer room, if the host runs it", async () => {
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
    const hostConnectionID = (globalThis as any).rooms[0].host.connectionID;

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

    const members = (globalThis as any).rooms[0].memberConnectionIDs;
    const targets = members.filter((e: string) => e !== hostConnectionID);
    const targetConnectionID = targets[0];
    const targetName = universal.getNameFromConnectionID(targetConnectionID);

    const kickCommandMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: `/kick ${targetName}`
      }
    };

    // socket1 because the creator is the host.
    socket1.send(JSON.stringify(kickCommandMessage));

    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("kicked") > -1
      );
    });

    assert.equal((globalThis as any).rooms[0].memberConnectionIDs.length, 1);

    socket1.close();
    socket2.close();
  });

  it("should be able to run the /transferhost command in a multiplayer room, if the host runs it", async () => {
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
    const hostConnectionID = (globalThis as any).rooms[0].host.connectionID;
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

    const firstHostConnectionID = (globalThis as any).rooms[0]
      .memberConnectionIDs[0];

    assert.equal((globalThis as any).rooms[0].memberConnectionIDs.length, 2);
    assert.equal(
      (globalThis as any).rooms[0].host.connectionID,
      firstHostConnectionID
    );

    const members = (globalThis as any).rooms[0].memberConnectionIDs;
    const targets = members.filter((e: string) => e != hostConnectionID);
    const targetConnectionID = targets[0];
    const targetName = universal.getNameFromConnectionID(targetConnectionID);

    const transferHostCommandMessage = {
      message: {
        message: "sendChatMessage",
        scope: "room",
        chatMessage: `/transferhost ${targetName}`
      }
    };

    // socket1 because the creator is the host.
    socket1.send(JSON.stringify(transferHostCommandMessage));

    await waitForWebSocketMessage(socket1, (data: { [key: string]: any }) => {
      return (
        data.message === "addRoomChatMessage" &&
        data.data.message.indexOf("host") > -1
      );
    });

    assert.equal((globalThis as any).rooms[0].memberConnectionIDs.length, 2);
    assert.equal(
      (globalThis as any).rooms[0].host.connectionID,
      targetConnectionID
    );

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
