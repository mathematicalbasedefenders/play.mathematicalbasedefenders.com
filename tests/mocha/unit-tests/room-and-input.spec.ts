import assert from "node:assert/strict";
import {
  GameMode,
  MultiplayerGameData,
  SingleplayerGameData
} from "../../../server/src/game/GameData";
import { Enemy } from "../../../server/src/game/Enemy";
import { MultiplayerRoom } from "../../../server/src/game/MultiplayerRoom";
import {
  getOpponentsInformation,
  processKeypressForRoom
} from "../../../server/src/game/Room";
import {
  InputAction,
  processInputInformation
} from "../../../server/src/core/input";
import { createFakeSocket } from "../utilities";

describe("Room membership, commands, and input", () => {
  beforeEach(() => {
    (globalThis as any).rooms = [];
    (globalThis as any).sockets = [];
  });

  function createRoomWithTwoMembers() {
    const host = createFakeSocket({
      connectionID: "VALIDATIONHOST01",
      ownerGuestName: "Host Player"
    });
    const member = createFakeSocket({
      connectionID: "VALIDATIONMEMB1",
      ownerGuestName: "Member Player"
    });
    (globalThis as any).sockets.push(host.socket, member.socket);
    const room = new MultiplayerRoom(host.socket, GameMode.CustomMultiplayer);
    room.addMember(host.socket);
    room.addMember(member.socket);
    return { room, host, member };
  }

  it("keeps member and spectator collections mutually exclusive", () => {
    const host = createFakeSocket({ connectionID: "MEMBERSHIPHOST01" });
    const spectator = createFakeSocket({ connectionID: "SPECTATORROOM001" });
    (globalThis as any).sockets.push(host.socket, spectator.socket);
    const room = new MultiplayerRoom(host.socket, GameMode.CustomMultiplayer);

    room.addMember(host.socket);
    room.addMember(host.socket);
    room.addSpectator(host.socket);
    room.addSpectator(spectator.socket);
    room.addMember(spectator.socket);

    assert.deepEqual(room.memberConnectionIDs, ["MEMBERSHIPHOST01"]);
    assert.deepEqual(room.spectatorConnectionIDs, ["SPECTATORROOM001"]);
    assert.deepEqual(host.subscriptions, [room.id]);

    room.deleteSpectator(spectator.socket);
    room.deleteMember(host.socket);
    assert.deepEqual(room.memberConnectionIDs, []);
    assert.deepEqual(room.spectatorConnectionIDs, []);
  });

  it("kicks a member with notification, navigation, and unsubscription", () => {
    const { room, host, member } = createRoomWithTwoMembers();

    room.kickMember(host.socket, member.socket);

    assert.deepEqual(room.memberConnectionIDs, ["VALIDATIONHOST01"]);
    assert.deepEqual(member.unsubscriptions, [room.id]);
    assert.deepEqual(member.toastNotifications, [
      {
        text: "You have been kicked from this Custom Multiplayer room!",
        borderColor: "#ff0000"
      }
    ]);
    assert.deepEqual(member.sentMessages.at(-1), {
      message: "changeScreen",
      newScreen: "mainMenu"
    });
  });

  it("destroys a room and removes all member and spectator references", () => {
    const { room, host } = createRoomWithTwoMembers();
    const spectator = createFakeSocket({ connectionID: "DESTROYSPECTATOR" });
    (globalThis as any).sockets.push(spectator.socket);
    room.addSpectator(spectator.socket);

    room.destroy();

    assert.equal((globalThis as any).rooms.includes(room), false);
    assert.deepEqual(room.memberConnectionIDs, []);
    assert.deepEqual(room.spectatorConnectionIDs, []);
    assert.equal(host.socket.getUserData().connectionID, "VALIDATIONHOST01");
  });

  it("validates start command permissions and room state", () => {
    const { room } = createRoomWithTwoMembers();
    assert.deepEqual(room.validateStartCommandForRoom(true), {
      valid: true,
      errors: []
    });

    room.playing = true;
    const invalid = room.validateStartCommandForRoom(false);
    assert.equal(invalid.valid, false);
    assert.equal(invalid.errors.some((error) => error.includes("host")), true);
    assert.equal(
      invalid.errors.some((error) => error.includes("active game")),
      true
    );

    room.playing = false;
    room.mode = GameMode.DefaultMultiplayer;
    assert.equal(room.validateStartCommandForRoom(true).valid, false);
  });

  it("validates set command syntax, targets, and value boundaries", () => {
    const { room } = createRoomWithTwoMembers();

    assert.match(
      room.validateSetCommandForRoom(true, []).errors[0],
      /at least 2 arguments/
    );
    assert.match(
      room.validateSetCommandForRoom(true, ["baseHealth", "nope"]).errors[0],
      /not a number/
    );
    assert.match(
      room.validateSetCommandForRoom(true, ["missing", "10"]).errors[0],
      /doesn't exist/
    );
    assert.equal(
      room.validateSetCommandForRoom(true, ["baseHealth", "0"]).valid,
      false
    );

    const valid = room.validateSetCommandForRoom(true, [
      "ENEMYSPAWNTIME",
      "250"
    ]);
    assert.deepEqual(valid, {
      valid: true,
      errors: [],
      target: "enemySpawnTime"
    });

    room.setRoomConstant("ENEMYSPAWNTIME", "250");
    assert.equal(room.customSettings.enemySpawnTime, 250);
    assert.equal(
      room.validateSetCommandForRoom(false, ["baseHealth", "100"]).valid,
      false
    );
  });

  it("validates visibility, kick, and host-transfer targets", () => {
    const { room } = createRoomWithTwoMembers();

    assert.equal(
      room.validateSetVisibilityCommandForRoom(true, ["true"]).valid,
      true
    );
    assert.equal(
      room.validateSetVisibilityCommandForRoom(true, ["yes"]).valid,
      false
    );
    assert.equal(
      room.validateSetVisibilityCommandForRoom(false, ["false"]).valid,
      false
    );

    assert.equal(room.validateKickCommandForRoom(true, [], "Host Player").valid, false);
    assert.equal(
      room.validateKickCommandForRoom(true, ["Nobody"], "Host Player").valid,
      false
    );
    assert.equal(
      room.validateKickCommandForRoom(
        true,
        ["Host", "Player"],
        "Host Player"
      ).valid,
      false
    );
    assert.equal(
      room.validateKickCommandForRoom(
        true,
        ["Member", "Player"],
        "Host Player"
      ).valid,
      true
    );

    assert.equal(
      room.validateTransferHostCommandForRoom(true, [], "Host Player").valid,
      false
    );
    assert.equal(
      room.validateTransferHostCommandForRoom(
        true,
        ["Host", "Player"],
        "Host Player"
      ).valid,
      false
    );
    assert.equal(
      room.validateTransferHostCommandForRoom(
        true,
        ["Member", "Player"],
        "Host Player"
      ).valid,
      true
    );
  });

  it("returns full, minified, and eliminated opponent data", () => {
    const { room, host, member } = createRoomWithTwoMembers();
    const hostData = new MultiplayerGameData(
      host.socket,
      GameMode.CustomMultiplayer
    );
    const memberData = new MultiplayerGameData(
      member.socket,
      GameMode.CustomMultiplayer
    );
    memberData.baseHealth = 75;
    memberData.currentInput = "12";
    room.gameData = [hostData, memberData];
    room.connectionIDsThisRound = [
      host.userData.connectionID,
      member.userData.connectionID
    ];

    assert.deepEqual(getOpponentsInformation(host.socket, room, false), [
      memberData
    ]);
    const minified = getOpponentsInformation(host.socket, room, true);
    assert.equal(minified.length, 1);
    assert.equal(minified[0].owner, member.userData.connectionID);
    assert.equal(minified[0].baseHealth, 75);
    assert.equal(minified[0].currentInput, "12");

    room.gameData = [hostData];
    assert.deepEqual(getOpponentsInformation(host.socket, room, true), [
      { owner: member.userData.connectionID, baseHealth: -99999 }
    ]);
  });

  it("kills every enemy matching a submitted answer", () => {
    const owner = createFakeSocket({ connectionID: "ANSWEROWNER00001" });
    (globalThis as any).sockets.push(owner.socket);
    const room = new MultiplayerRoom(owner.socket, GameMode.CustomMultiplayer);
    room.addMember(owner.socket);
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.StandardSingleplayer
    );
    data.enemies = [
      new Enemy(-4, "-2 - 2", 0, 0.5, 0.1, "matching-1"),
      new Enemy(-4, "-8 / 2", 0, 0.5, 0.1, "matching-2"),
      new Enemy(5, "2 + 3", 0, 0.5, 0.1, "remaining")
    ];
    data.currentInput = "-4";
    room.gameData = [data];

    processInputInformation(
      { action: InputAction.SendAnswer, argument: "" },
      data
    );

    assert.deepEqual(
      data.enemies.map((enemy) => enemy.id),
      ["remaining"]
    );
    assert.equal(data.enemiesKilled, 2);
    assert.equal(data.combo, 1);
    assert.equal(data.currentInput, "");
    assert.equal(
      room.gameActionRecord.actionRecords.some(
        (record) => record.action === "submit" && record.data.submitted === "-4"
      ),
      true
    );
  });

  for (const invalidInput of ["01", "--4", "4-", "", "123456789"]) {
    it(`does not kill enemies for malformed input ${JSON.stringify(invalidInput)}`, () => {
      const owner = createFakeSocket({ connectionID: "BADANSWEROWNER01" });
      (globalThis as any).sockets.push(owner.socket);
      const room = new MultiplayerRoom(
        owner.socket,
        GameMode.CustomMultiplayer
      );
      room.addMember(owner.socket);
      const data = new SingleplayerGameData(
        owner.socket,
        GameMode.EasySingleplayer
      );
      data.enemies = [new Enemy(1, "1", 0, 0.5, 0.1, "target")];
      data.currentInput = invalidInput;
      room.gameData = [data];

      processInputInformation(
        { action: InputAction.SendAnswer, argument: "" },
        data
      );

      assert.equal(data.enemies.length, 1);
      assert.equal(data.enemiesKilled, 0);
      assert.equal(data.currentInput, invalidInput);
    });
  }

  it("releases multiplayer received-enemy stock after an incorrect answer", () => {
    const owner = createFakeSocket({ connectionID: "STOCKOWNER000001" });
    (globalThis as any).sockets.push(owner.socket);
    const room = new MultiplayerRoom(owner.socket, GameMode.CustomMultiplayer);
    room.addMember(owner.socket);
    const data = new MultiplayerGameData(
      owner.socket,
      GameMode.CustomMultiplayer
    );
    data.enemies = [new Enemy(10, "10", 0, 0.5, 0.1, "target")];
    data.currentInput = "9";
    data.receivedEnemiesStock = 3;
    room.gameData = [data];

    processInputInformation(
      { action: InputAction.SendAnswer, argument: "" },
      data
    );

    assert.equal(data.receivedEnemiesStock, 0);
    assert.equal(data.receivedEnemiesToSpawn, 3);
    assert.equal(
      room.gameActionRecord.actionRecords.at(-1)?.action,
      "stockRelease"
    );
  });

  it("routes known keypresses to room game data and ignores unknown keys", () => {
    const owner = createFakeSocket({ connectionID: "KEYPRESSOWNER001" });
    (globalThis as any).sockets.push(owner.socket);
    const room = new MultiplayerRoom(owner.socket, GameMode.CustomMultiplayer);
    room.addMember(owner.socket);
    const data = new MultiplayerGameData(
      owner.socket,
      GameMode.CustomMultiplayer
    );
    room.gameData = [data];

    processKeypressForRoom(owner.userData.connectionID, "Digit8");
    processKeypressForRoom(owner.userData.connectionID, "KeyQ");

    assert.equal(data.currentInput, "8");
    assert.equal(data.actionsPerformed, 1);
  });
});
