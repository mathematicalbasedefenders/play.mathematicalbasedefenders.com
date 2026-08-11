import assert from "node:assert/strict";
import os from "node:os";
import sinon from "sinon";
import * as universal from "../../../server/src/universal";
import {
  GameMode,
  MultiplayerGameData,
  SingleplayerGameData
} from "../../../server/src/game/GameData";
import { Enemy } from "../../../server/src/game/Enemy";
import { MultiplayerRoom } from "../../../server/src/game/MultiplayerRoom";
import { SingleplayerRoom } from "../../../server/src/game/SingleplayerRoom";
import { updateSystemStatus } from "../../../server/src/core/status-indicators";
import {
  rateLimitSocket,
  WebSocketRateLimit
} from "../../../server/src/core/rate-limiting";
import { createFakeSocket } from "../utilities";

describe("Socket lifecycle, synchronization, and status", () => {
  beforeEach(() => {
    (globalThis as any).rooms = [];
    (globalThis as any).sockets = [];
  });

  afterEach(() => sinon.restore());

  function initializeFakeSocket() {
    const fake = createFakeSocket();
    universal.initializeSocket(fake.socket);
    (globalThis as any).sockets.push(fake.socket);
    return fake;
  }

  it("initializes unique socket identity, methods, and game subscription", () => {
    const first = initializeFakeSocket();
    const second = initializeFakeSocket();

    assert.match(first.userData.connectionID, /^[A-Z0-9]{16}$/);
    assert.match(first.userData.ownerGuestName, /^Guest [0-9]{8}$/);
    assert.notEqual(first.userData.connectionID, second.userData.connectionID);
    assert.notEqual(first.userData.ownerGuestName, second.userData.ownerGuestName);
    assert.equal(first.userData.loggedIn, false);
    assert.equal(first.userData.exitedOpeningScreen, false);
    assert.equal(first.userData.accumulatedMessages, 0);
    assert.deepEqual(first.userData.rateLimiting, { last: 1, count: 0 });
    assert.deepEqual(first.subscriptions, ["game"]);
    for (const method of [
      "teardown",
      "forceTeardown",
      "synchronizeToClientSide",
      "synchronizeMetadataToClientSide",
      "sendToastNotification",
      "processKeypress",
      "emulateKeypress",
      "sendMessageToChat",
      "leaveMultiplayerRoom",
      "joinMultiplayerRoom"
    ]) {
      assert.equal(typeof first.userData[method], "function");
    }
  });

  it("sends the socket ID and guest identity as initial data", () => {
    const fake = initializeFakeSocket();

    universal.sendInitialSocketData(fake.socket);

    assert.deepEqual(fake.sentMessages, [
      {
        message: "changeValueOfInput",
        selector: "#authentication-modal__socket-id",
        value: fake.userData.connectionID
      },
      {
        message: "updateGuestInformationText",
        data: { guestName: fake.userData.ownerGuestName }
      }
    ]);
  });

  it("looks up sockets, names, user sessions, and game data", () => {
    const guest = createFakeSocket({
      connectionID: "LOOKUPGUEST00001",
      ownerGuestName: "Guest Lookup"
    });
    const registered = createFakeSocket({
      connectionID: "LOOKUPUSER000001",
      loggedIn: true,
      ownerUsername: "registered-user",
      ownerUserID: "shared-user-id"
    });
    const secondSession = createFakeSocket({
      connectionID: "LOOKUPUSER000002",
      ownerUserID: "shared-user-id"
    });
    (globalThis as any).sockets.push(
      guest.socket,
      registered.socket,
      secondSession.socket
    );
    const room = new MultiplayerRoom(
      registered.socket,
      GameMode.CustomMultiplayer
    );
    room.addMember(registered.socket);
    const data = new MultiplayerGameData(
      registered.socket,
      GameMode.CustomMultiplayer
    );
    room.gameData = [data];

    assert.equal(
      universal.getSocketFromConnectionID("LOOKUPGUEST00001"),
      guest.socket
    );
    assert.deepEqual(universal.getSocketsFromUserID("shared-user-id"), [
      registered.socket,
      secondSession.socket
    ]);
    assert.equal(
      universal.getNameFromConnectionID("LOOKUPGUEST00001"),
      "Guest Lookup"
    );
    assert.equal(
      universal.getNameFromConnectionID("LOOKUPUSER000001"),
      "registered-user"
    );
    assert.equal(universal.getNameFromConnectionID("missing"), "???");
    assert.equal(
      universal.getGameDataFromConnectionID("LOOKUPUSER000001"),
      data
    );
    assert.equal(universal.getGameDataFromConnectionID("missing"), null);
  });

  it("synchronizes server and socket metadata", () => {
    const target = initializeFakeSocket();
    target.userData.loggedIn = true;
    target.userData.ownerUsername = "metadata-user";
    const guest = createFakeSocket({ connectionID: "METADATAGUEST001" });
    (globalThis as any).sockets.push(guest.socket);

    const singleRoom = new SingleplayerRoom(
      target.socket,
      GameMode.EasySingleplayer
    );
    singleRoom.addMember(target.socket);
    singleRoom.gameData = [
      new SingleplayerGameData(target.socket, GameMode.EasySingleplayer)
    ];
    (globalThis as any).rooms.push(singleRoom);
    new MultiplayerRoom(guest.socket, GameMode.CustomMultiplayer);

    target.userData.synchronizeMetadataToClientSide(50, {
      os: { level: 1, usage: 0.9 },
      updateTime: { level: 0, time: 50 }
    });

    const serverMetadata = target.sentMessages[0];
    assert.equal(serverMetadata.message, "updateServerMetadata");
    assert.deepEqual(serverMetadata.data, {
      onlineTotal: 2,
      onlineRegistered: 1,
      onlineGuests: 1,
      roomsTotal: 2,
      roomsMulti: 1,
      roomsSingle: 1,
      lastUpdated: 50,
      osUsageLevel: 1,
      osUsageToShow: 0.9,
      updateTimeLevel: 0,
      updateTimeToShow: -1,
      playerName: "metadata-user",
      playerRank: "???",
      playerLevel: "???"
    });
    assert.deepEqual(target.sentMessages[1], {
      message: "updateSocketMetadata",
      data: { playing: true, inMultiplayerRoom: false }
    });
  });

  it("synchronizes minified multiplayer data and opponent state", () => {
    const target = initializeFakeSocket();
    const opponent = initializeFakeSocket();
    target.userData.loggedIn = false;
    opponent.userData.loggedIn = false;
    const room = new MultiplayerRoom(
      target.socket,
      GameMode.CustomMultiplayer
    );
    room.addMember(target.socket);
    room.addMember(opponent.socket);
    const targetData = new MultiplayerGameData(
      target.socket,
      GameMode.CustomMultiplayer
    );
    const opponentData = new MultiplayerGameData(
      opponent.socket,
      GameMode.CustomMultiplayer
    );
    targetData.enemies = [
      new Enemy(7, "3 + 4", 0.123456, 0.987654, 0.1, "enemy")
    ];
    room.gameData = [targetData, opponentData];
    room.connectionIDsThisRound = [
      target.userData.connectionID,
      opponent.userData.connectionID
    ];

    target.userData.synchronizeToClientSide();

    assert.equal(target.sentMessages.length, 1);
    assert.equal(target.sentMessages[0].message, "renderGameData");
    const rendered = JSON.parse(target.sentMessages[0].data);
    assert.equal(rendered.enemies[0].requestedValue, undefined);
    assert.equal(rendered.enemies[0].xPosition, 0.123);
    assert.equal(rendered.enemies[0].sPosition, 0.988);
    assert.equal(rendered.totalEnemiesReceived, undefined);
    assert.equal(rendered.totalEnemiesSent, undefined);
    assert.equal(rendered.opponentGameData.length, 1);
    assert.equal(
      rendered.opponentGameData[0].owner,
      opponent.userData.connectionID
    );
    assert.equal(typeof rendered.timestampOfSynchronization, "number");
    assert.equal(targetData.enemies[0].requestedValue, 7);
  });

  it("broadcasts string, object, and toast messages to all sockets", () => {
    const first = createFakeSocket({ connectionID: "BROADCASTFIRST01" });
    const second = createFakeSocket({ connectionID: "BROADCASTSECOND1" });
    (globalThis as any).sockets.push(first.socket, second.socket);

    universal.sendGlobalWebSocketMessage(
      JSON.stringify({ message: "rawBroadcast", value: 1 })
    );
    universal.sendGlobalWebSocketMessage({ kind: "objectBroadcast" });
    universal.sendGlobalToastNotification({
      text: "Server notice",
      borderColor: "#112233"
    });

    for (const fake of [first, second]) {
      assert.deepEqual(fake.sentMessages, [
        { message: "rawBroadcast", value: 1 },
        { message: { kind: "objectBroadcast" } },
        {
          message: "createToastNotification",
          text: "Server notice",
          options: { text: "Server notice", borderColor: "#112233" }
        }
      ]);
    }
  });

  it("removes a socket normally and closes it during forced teardown", () => {
    const normal = initializeFakeSocket();
    const room = new SingleplayerRoom(
      normal.socket,
      GameMode.EasySingleplayer
    );
    room.addMember(normal.socket);
    (globalThis as any).rooms.push(room);

    assert.equal(normal.userData.teardown(), true);
    assert.equal((globalThis as any).sockets.includes(normal.socket), false);
    assert.equal(room.memberConnectionIDs.length, 0);

    const forced = initializeFakeSocket();
    assert.equal(forced.userData.forceTeardown(), true);
    assert.equal((globalThis as any).sockets.includes(forced.socket), false);
    assert.equal(forced.calls.close, 1);
  });

  it("reports system memory and update-time warning levels", () => {
    sinon.stub(os, "totalmem").returns(100);
    const freeMemory = sinon.stub(os, "freemem");

    freeMemory.returns(20);
    universal.STATUS.lastDeltaTimeToUpdate = 20;
    assert.deepEqual(updateSystemStatus(5000), {
      os: { level: 0, usage: 0.8 },
      updateTime: { level: 0, time: 20 }
    });

    freeMemory.returns(10);
    universal.STATUS.lastDeltaTimeToUpdate = 50;
    assert.deepEqual(updateSystemStatus(5000), {
      os: { level: 1, usage: 0.9 },
      updateTime: { level: 1, time: 50 }
    });

    freeMemory.returns(4);
    universal.STATUS.lastDeltaTimeToUpdate = 100;
    assert.deepEqual(updateSystemStatus(5000), {
      os: { level: 2, usage: 0.96 },
      updateTime: { level: 2, time: 100 }
    });
  });

  it("resets rate-limit windows and tears down rate-limited sockets", () => {
    const clock = sinon.useFakeTimers({ now: 3000 });
    const fake = createFakeSocket({
      connectionID: "RATELIMITSOCKET1",
      rateLimiting: { last: 1000, count: 2 }
    });
    const limit = WebSocketRateLimit(2, 1000);

    assert.equal(limit(fake.socket), false);
    assert.deepEqual(fake.userData.rateLimiting, { last: 3000, count: 1 });

    rateLimitSocket(fake.socket);
    assert.deepEqual(fake.toastNotifications, [
      {
        borderColor: "#ff0000",
        text: "You're going too fast! You have rate-limited and been disconnected."
      }
    ]);
    assert.equal(fake.calls.forceTeardown, 1);
    clock.restore();
  });
});
