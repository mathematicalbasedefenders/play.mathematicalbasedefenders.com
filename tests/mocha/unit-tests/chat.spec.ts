import assert from "node:assert/strict";
import sinon from "sinon";
import { sendChatMessage } from "../../../server/src/core/chat";
import { MultiplayerRoom } from "../../../server/src/game/MultiplayerRoom";
import { SingleplayerRoom } from "../../../server/src/game/SingleplayerRoom";
import { GameMode } from "../../../server/src/game/GameData";
import { createFakeSocket } from "../utilities";

describe("Chat routing and validation", () => {
  beforeEach(() => {
    (globalThis as any).rooms = [];
    (globalThis as any).sockets = [];
  });

  afterEach(() => sinon.restore());

  it("publishes valid global chat with sender identity and rank color", () => {
    const sender = createFakeSocket({
      connectionID: "GLOBALSENDER00001",
      loggedIn: true,
      ownerUsername: "chat-user",
      ownerUserID: "user-id",
      playerRank: { title: "Tester", color: "#123456" }
    });
    (globalThis as any).sockets.push(sender.socket);

    sendChatMessage("global", "Hello everyone", sender.socket);

    assert.equal(sender.publishedMessages.length, 1);
    assert.equal(sender.publishedMessages[0].channel, "game");
    assert.deepEqual(sender.publishedMessages[0].message.data, {
      sender: "chat-user",
      message: {
        sender: "chat-user",
        message: "Hello everyone",
        senderUserID: "user-id"
      },
      attribute: "",
      location: "#chat-tray-message-container",
      senderColor: "#123456"
    });
    assert.equal(sender.sentMessages[0].message, "addChatMessage");
    assert.deepEqual(sender.sentMessages[1], {
      message: "changeText",
      selector: "#chat-tray-error",
      value: ""
    });
  });

  for (const [name, message] of [
    ["empty messages", ""],
    ["whitespace-only messages", " \t\n"],
    ["overlong messages", "x".repeat(257)],
    ["unsafe HTML messages", '<img src="x" onerror="alert(1)">']
  ] as const) {
    it(`rejects ${name} from global chat`, () => {
      const sender = createFakeSocket({ connectionID: "INVALIDCHAT00001" });
      (globalThis as any).sockets.push(sender.socket);

      sendChatMessage("global", message, sender.socket);

      assert.equal(sender.publishedMessages.length, 0);
      assert.deepEqual(sender.sentMessages, [
        {
          message: "changeText",
          selector: "#chat-tray-error",
          value: "Message not sent: Bad chat validation."
        }
      ]);
    });
  }

  it("delivers valid room chat to every member", () => {
    const host = createFakeSocket({
      connectionID: "ROOMHOST00000001",
      loggedIn: true,
      ownerUsername: "Room Host",
      ownerUserID: "host-id",
      playerRank: { title: "", color: "#abcdef" }
    });
    const member = createFakeSocket({ connectionID: "ROOMMEMBER000001" });
    (globalThis as any).sockets.push(host.socket, member.socket);
    const room = new MultiplayerRoom(host.socket, GameMode.CustomMultiplayer);
    room.addMember(host.socket);
    room.addMember(member.socket);

    sendChatMessage("room", "Room hello", host.socket);

    assert.deepEqual(room.chatMessages, [
      { message: "Room hello", senderName: "Room Host" }
    ]);
    for (const target of [host, member]) {
      assert.deepEqual(target.sentMessages.at(-1), {
        message: "addRoomChatMessage",
        scope: "custom",
        data: {
          name: "Room Host",
          message: "Room hello",
          nameColor: "#abcdef",
          userID: "host-id"
        }
      });
    }
  });

  it("allows a spectator to send chat to multiplayer room members", () => {
    const host = createFakeSocket({ connectionID: "SPECTATORHOST001" });
    const spectator = createFakeSocket({
      connectionID: "SPECTATOR0000001",
      ownerGuestName: "Guest Spectator"
    });
    (globalThis as any).sockets.push(host.socket, spectator.socket);
    const room = new MultiplayerRoom(host.socket, GameMode.CustomMultiplayer);
    room.addMember(host.socket);
    room.addSpectator(spectator.socket);

    sendChatMessage("room", "Watching", spectator.socket);

    assert.equal(host.sentMessages.at(-1).data.name, "Guest Spectator");
    assert.equal(host.sentMessages.at(-1).data.message, "Watching");
  });

  it("delegates slash-prefixed room messages to the command runner", () => {
    const host = createFakeSocket({ connectionID: "COMMANDHOST00001" });
    (globalThis as any).sockets.push(host.socket);
    const room = new MultiplayerRoom(host.socket, GameMode.CustomMultiplayer);
    room.addMember(host.socket);
    const command = sinon.stub(room, "runChatCommand");

    sendChatMessage("room", "/get", host.socket);

    assert.equal(command.calledOnce, true);
    assert.equal(command.firstCall.args[0], "/get");
    assert.equal(command.firstCall.args[1].sender, host.socket);
    assert.equal(room.chatMessages.length, 0);
  });

  it("rejects room chat when the sender is outside a multiplayer room", () => {
    const sender = createFakeSocket({ connectionID: "OUTSIDEROOM00001" });
    (globalThis as any).sockets.push(sender.socket);

    sendChatMessage("room", "Nobody hears this", sender.socket);
    assert.equal(sender.sentMessages.length, 0);

    const room = new SingleplayerRoom(
      sender.socket,
      GameMode.EasySingleplayer
    );
    (globalThis as any).rooms.push(room);
    room.addMember(sender.socket);
    sendChatMessage("room", "Still invalid", sender.socket);
    assert.equal(sender.sentMessages.length, 0);
  });

  it("sanitizes system room messages before storing and sending", () => {
    const host = createFakeSocket({ connectionID: "SYSTEMHOST000001" });
    (globalThis as any).sockets.push(host.socket);
    const room = new MultiplayerRoom(host.socket, GameMode.CustomMultiplayer);
    room.addMember(host.socket);

    room.addChatMessage("Safe <b>text</b><script>bad()</script>", {
      isSystemMessage: true
    });

    assert.equal(
      (room.chatMessages[0] as any).message,
      "Safe <b>text</b>"
    );
    assert.equal(host.sentMessages.at(-1).data.name, "(System)");
    assert.equal(host.sentMessages.at(-1).data.message, "Safe <b>text</b>");
  });
});
