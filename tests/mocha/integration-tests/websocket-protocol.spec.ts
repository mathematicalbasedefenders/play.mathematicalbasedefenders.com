import assert from "node:assert/strict";
import { MultiplayerRoom } from "../../../server/src/game/MultiplayerRoom";
import { GameMode } from "../../../server/src/game/GameData";
import {
  createFakeSocket,
  openTestSocket,
  sendProtocolMessage,
  waitForWebSocketClose,
  waitForWebSocketMessage
} from "../utilities";

describe("WebSocket protocol reliability", () => {
  beforeEach(() => {
    (globalThis as any).rooms = [];
    (globalThis as any).sockets = [];
  });

  async function exitOpeningScreen(socket: WebSocket) {
    const acknowledgement = waitForWebSocketMessage(
      socket,
      (data: any) =>
        data.message === "acknowledge" &&
        data.acknowledgedMessage === "exitOpeningScreen"
    );
    sendProtocolMessage(socket, { message: "exitOpeningScreen" });
    await acknowledgement;
  }

  it("blocks gameplay actions before the opening screen is exited", async () => {
    const { socket } = await openTestSocket();
    try {
      const blocked = waitForWebSocketMessage(
        socket,
        (data: any) =>
          data.message === "createToastNotification" &&
          data.text.includes("properly exit the opening screen")
      );
      sendProtocolMessage(socket, {
        message: "startGame",
        mode: "singleplayer",
        modifier: "easy"
      });

      const response: any = await blocked;
      assert.equal(response.options.borderColor, "#ff0000");
      assert.equal((globalThis as any).rooms.length, 0);
    } finally {
      socket.close();
    }
  });

  it("prevents a socket from creating a second multiplayer room", async () => {
    const { socket, connectionID } = await openTestSocket();
    try {
      await exitOpeningScreen(socket);
      const created = waitForWebSocketMessage(
        socket,
        (data: any) =>
          data.message === "changeScreen" &&
          data.newScreen === "customMultiplayerIntermission"
      );
      sendProtocolMessage(socket, { message: "createMultiplayerRoom" });
      await created;

      const rejected = waitForWebSocketMessage(
        socket,
        (data: any) =>
          data.message === "createToastNotification" &&
          data.text.includes("already in a room")
      );
      sendProtocolMessage(socket, { message: "createMultiplayerRoom" });
      await rejected;

      assert.equal((globalThis as any).rooms.length, 1);
      assert.deepEqual((globalThis as any).rooms[0].memberConnectionIDs, [
        connectionID
      ]);
    } finally {
      socket.close();
    }
  });

  it("returns only visible custom multiplayer rooms in the room list", async () => {
    const { socket } = await openTestSocket();
    try {
      await exitOpeningScreen(socket);
      const publicHost = createFakeSocket({
        connectionID: "PUBLICROOMHOST01",
        ownerGuestName: "Public Host"
      });
      const hiddenHost = createFakeSocket({
        connectionID: "HIDDENROOMHOST01",
        ownerGuestName: "Hidden Host"
      });
      (globalThis as any).sockets.push(publicHost.socket, hiddenHost.socket);
      const publicRoom = new MultiplayerRoom(
        publicHost.socket,
        GameMode.CustomMultiplayer
      );
      publicRoom.addMember(publicHost.socket);
      const hiddenRoom = new MultiplayerRoom(
        hiddenHost.socket,
        GameMode.CustomMultiplayer
      );
      hiddenRoom.addMember(hiddenHost.socket);
      hiddenRoom.hidden = true;

      const listMessage = waitForWebSocketMessage(
        socket,
        (data: any) => data.message === "updateMultiplayerRoomList"
      );
      sendProtocolMessage(socket, { message: "getMultiplayerRoomList" });
      const response: any = await listMessage;

      assert.equal(response.data.length, 1);
      assert.equal(response.data[0].id, publicRoom.id);
      assert.equal(response.data[0].playerCount, 1);
      assert.equal(response.data[0].spectatorCount, 0);
      assert.match(response.data[0].name, /Public Host/);
    } finally {
      socket.close();
    }
  });

  it("processes real and emulated keypress protocol messages", async () => {
    const { socket, connectionID } = await openTestSocket();
    try {
      await exitOpeningScreen(socket);
      const started = waitForWebSocketMessage(
        socket,
        (data: any) =>
          data.message === "acknowledge" &&
          data.acknowledgedMessage === "startGame"
      );
      sendProtocolMessage(socket, {
        message: "startGame",
        mode: "singleplayer",
        modifier: "standard"
      });
      await started;

      const firstRender = waitForWebSocketMessage(
        socket,
        (data: any) =>
          data.message === "renderGameData" &&
          JSON.parse(data.data).currentInput === "3"
      );
      sendProtocolMessage(socket, {
        message: "keypress",
        keypress: "Digit3"
      });
      await firstRender;

      const secondRender = waitForWebSocketMessage(
        socket,
        (data: any) =>
          data.message === "renderGameData" &&
          JSON.parse(data.data).currentInput === "34"
      );
      sendProtocolMessage(socket, {
        message: "emulateKeypress",
        emulatedKeypress: "Digit4"
      });
      await secondRender;

      const room = (globalThis as any).rooms.find((candidate: any) =>
        candidate.memberConnectionIDs.includes(connectionID)
      );
      const keypresses = room.gameActionRecord.actionRecords.filter(
        (record: any) => record.action === "keypress"
      );
      assert.deepEqual(
        keypresses.map((record: any) => record.data),
        [
          { code: "Digit3", emulated: false },
          { code: "Digit4", emulated: true }
        ]
      );
    } finally {
      socket.close();
    }
  });

  it("disconnects a socket that sends an oversized message", async () => {
    const { socket } = await openTestSocket();
    await exitOpeningScreen(socket);
    const closed = waitForWebSocketClose(socket);

    sendProtocolMessage(socket, {
      message: "sendChatMessage",
      scope: "global",
      chatMessage: "x".repeat(3000)
    });

    await closed;
    assert.equal(socket.readyState, WebSocket.CLOSED);
  });
});
