import assert from "node:assert/strict";
import sinon from "sinon";
import {
  GameMode,
  MultiplayerGameData,
  SingleplayerGameData
} from "../../../server/src/game/GameData";
import { Enemy } from "../../../server/src/game/Enemy";
import { MultiplayerRoom } from "../../../server/src/game/MultiplayerRoom";
import {
  createSingleplayerRoom,
  SingleplayerRoom
} from "../../../server/src/game/SingleplayerRoom";
import {
  checkGlobalMultiplayerRoomClocks,
  checkSingleplayerRoomClocks
} from "../../../server/src/game/actions/clocks";
import { updateSingleplayerRoomData } from "../../../server/src/game/actions/update";
import { createGameOverScreenText } from "../../../server/src/game/actions/create-text";
import { createFakeSocket } from "../utilities";

describe("Singleplayer lifecycle and game clocks", () => {
  beforeEach(() => {
    (globalThis as any).rooms = [];
    (globalThis as any).sockets = [];
  });

  afterEach(() => sinon.restore());

  it("starts singleplayer play with game data, replay owner, and settings", () => {
    const owner = createFakeSocket({ connectionID: "STARTPLAYOWNER01" });
    (globalThis as any).sockets.push(owner.socket);
    const room = createSingleplayerRoom(
      owner.socket,
      GameMode.StandardSingleplayer
    );
    room.addMember(owner.socket);

    room.startPlay();

    assert.equal(room.updating, true);
    assert.equal(room.gameData.length, 1);
    assert.equal(room.gameData[0].mode, GameMode.StandardSingleplayer);
    assert.equal(room.gameActionRecord.owner, owner.socket);
    assert.equal(room.gameActionRecord.actionRecords[0].action, "gameStart");
    assert.equal(
      room.gameActionRecord.actionRecords.some(
        (record) => record.action === "addUser"
      ),
      true
    );
    assert.equal(
      room.gameActionRecord.actionRecords.some(
        (record) =>
          record.action === "setGameData" &&
          record.data.key === "enemySpeedCoefficient"
      ),
      true
    );
  });

  it("does not update a room whose member socket cannot be found", () => {
    const owner = createFakeSocket({ connectionID: "MISSINGOWNER00001" });
    const room = new SingleplayerRoom(
      owner.socket,
      GameMode.EasySingleplayer
    );
    room.memberConnectionIDs = [owner.userData.connectionID];

    room.startPlay();

    assert.equal(room.gameData.length, 0);
    assert.equal(room.updating, false);
    assert.equal(room.gameActionRecord.owner, null);
  });

  it("parses valid custom settings and retains defaults for NaN values", () => {
    const owner = createFakeSocket();
    const room = new SingleplayerRoom(
      owner.socket,
      GameMode.CustomSingleplayer,
      {
        baseHealth: "250",
        comboTime: "not-a-number",
        enemySpeedCoefficient: "2.5",
        enemySpawnTime: "75",
        enemySpawnThreshold: "0.25",
        forcedEnemySpawnTime: "1500"
      }
    );

    assert.deepEqual(room.customSettings, {
      baseHealth: 250,
      comboTime: 5000,
      enemySpeedCoefficient: 2.5,
      enemySpawnThreshold: 0.25,
      enemySpawnTime: 75,
      forcedEnemySpawnTime: 1500
    });
  });

  it("aborts play, navigates to the main menu, and removes the member", () => {
    const owner = createFakeSocket({ connectionID: "ABORTOWNER000001" });
    (globalThis as any).sockets.push(owner.socket);
    const room = createSingleplayerRoom(
      owner.socket,
      GameMode.EasySingleplayer
    );
    room.addMember(owner.socket);
    room.startPlay();
    room.playing = true;
    const data = room.gameData[0];

    room.abort(data);

    assert.equal(room.playing, false);
    assert.deepEqual(data.commands.changeScreenTo, [
      { value: "mainMenu", age: 0 }
    ]);
    assert.deepEqual(owner.unsubscriptions, [room.id]);
    assert.deepEqual(room.memberConnectionIDs, []);
  });

  it("builds game-over commands, synchronizes, and removes the player", async () => {
    let synchronized = 0;
    const owner = createFakeSocket({
      connectionID: "GAMEOVEROWNER001",
      synchronizeToClientSide() {
        synchronized++;
      }
    });
    (globalThis as any).sockets.push(owner.socket);
    const room = createSingleplayerRoom(
      owner.socket,
      GameMode.EasySingleplayer
    );
    room.addMember(owner.socket);
    room.startPlay();
    room.playing = true;
    const data = room.gameData[0];
    Object.assign(data, {
      score: 1234,
      enemiesKilled: 5,
      enemiesSpawned: 8,
      elapsedTime: 10000,
      level: 3,
      enemiesToNextLevel: 4,
      actionsPerformed: 20
    });

    await room.startGameOverProcess(data);

    assert.equal(room.playing, false);
    assert.equal(synchronized, 1);
    assert.deepEqual(data.commands.changeScreenTo, [
      { value: "gameOver", age: 0 }
    ]);
    assert.equal(data.commands.updateText.length, 7);
    assert.equal(data.commands.updateText[0].value.newText, "1,234");
    assert.equal(data.commands.updateText[1].value.newText, "Easy Singleplayer");
    assert.deepEqual(owner.unsubscriptions, [room.id]);
    assert.deepEqual(room.memberConnectionIDs, []);
  });

  it("formats all game-over statistics deterministically", () => {
    const data = new SingleplayerGameData(
      createFakeSocket().socket,
      GameMode.StandardSingleplayer
    );
    Object.assign(data, {
      score: 2500,
      enemiesKilled: 8,
      enemiesSpawned: 10,
      elapsedTime: 20000,
      level: 4,
      enemiesToNextLevel: 2,
      actionsPerformed: 30
    });

    const messages = createGameOverScreenText(data, "Standard Singleplayer");
    const values = Object.fromEntries(
      messages.map((message) => [
        message.value.selector,
        message.value.newText
      ])
    );

    assert.equal(
      values["#main-content__game-over-screen__stats__enemies"],
      "8/10 (0.400/s)"
    );
    assert.equal(
      values["#main-content__game-over-screen__stats__time"],
      "0:20.000"
    );
    assert.equal(
      values["#main-content__game-over-screen__stats__level"],
      "4 (2 to next)"
    );
    assert.equal(
      values["#main-content__game-over-screen__stats__actions"],
      "90.000APM"
    );
  });

  it("processes forced spawns, combo reset, and health regeneration", () => {
    const owner = createFakeSocket({ connectionID: "CLOCKOWNER000001" });
    (globalThis as any).sockets.push(owner.socket);
    const room = createSingleplayerRoom(
      owner.socket,
      GameMode.StandardSingleplayer
    );
    room.addMember(owner.socket);
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.StandardSingleplayer
    );
    room.gameData = [data];
    data.baseHealth = 99;
    data.combo = 8;
    data.clocks.forcedEnemySpawn.currentTime =
      data.clocks.forcedEnemySpawn.actionTime;
    data.clocks.enemySpawn.currentTime = data.clocks.enemySpawn.actionTime;
    data.clocks.comboReset.currentTime = data.clocks.comboReset.actionTime;
    data.clocks.regenerateBaseHealth.currentTime =
      data.clocks.regenerateBaseHealth.actionTime;

    checkSingleplayerRoomClocks(data, room);

    assert.equal(data.enemies.length, 1);
    assert.equal(data.enemiesSpawned, 1);
    assert.equal(data.combo, -1);
    assert.equal(data.baseHealth, 100);
    assert.equal(data.clocks.forcedEnemySpawn.currentTime, 0);
    assert.equal(data.clocks.comboReset.currentTime, 0);
    assert.equal(data.clocks.regenerateBaseHealth.currentTime, 0);
  });

  it("uses the random spawn threshold when no forced spawn occurs", () => {
    sinon.stub(Math, "random").returns(0);
    const owner = createFakeSocket({ connectionID: "RANDOMOWNER00001" });
    (globalThis as any).sockets.push(owner.socket);
    const room = createSingleplayerRoom(
      owner.socket,
      GameMode.EasySingleplayer
    );
    room.addMember(owner.socket);
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.EasySingleplayer
    );
    room.gameData = [data];
    data.clocks.enemySpawn.currentTime = data.clocks.enemySpawn.actionTime;

    checkSingleplayerRoomClocks(data, room);

    assert.equal(data.enemies.length, 1);
    assert.equal(data.enemiesSpawned, 1);
  });

  it("updates global multiplayer spawn clocks deterministically", () => {
    sinon.stub(Math, "random").returns(0);
    const owner = createFakeSocket({ connectionID: "GLOBALCLOCKOWNER" });
    (globalThis as any).sockets.push(owner.socket);
    const room = new MultiplayerRoom(
      owner.socket,
      GameMode.DefaultMultiplayer
    );
    room.gameData = [
      new MultiplayerGameData(owner.socket, GameMode.DefaultMultiplayer)
    ];
    room.globalClock.enemySpawn.currentTime =
      room.globalClock.enemySpawn.actionTime;

    checkGlobalMultiplayerRoomClocks(room);
    assert.ok(room.globalEnemyToAdd);
    assert.equal(room.globalClock.enemySpawn.currentTime, 0);

    room.globalClock.forcedEnemySpawn.currentTime =
      room.globalClock.forcedEnemySpawn.actionTime;
    room.globalClock.enemySpawn.currentTime =
      room.globalClock.enemySpawn.actionTime;
    checkGlobalMultiplayerRoomClocks(room);
    assert.ok(room.globalEnemyToAdd);
    assert.equal(room.globalClock.forcedEnemySpawn.currentTime, 0);
  });

  it("moves enemies into the base and force-spawns a replacement", () => {
    const owner = createFakeSocket({ connectionID: "MOVEOWNER0000001" });
    (globalThis as any).sockets.push(owner.socket);
    const room = createSingleplayerRoom(
      owner.socket,
      GameMode.EasySingleplayer
    );
    room.addMember(owner.socket);
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.EasySingleplayer
    );
    const attacker = new Enemy(1, "1", 0, 0.01, 0.1, "attacker");
    data.enemies = [attacker];
    room.gameData = [data];

    updateSingleplayerRoomData(room, 200);

    assert.equal(data.baseHealth, 90);
    assert.equal(data.enemiesToErase.includes("attacker"), true);
    assert.equal(data.enemies.length, 1);
    assert.notEqual(data.enemies[0].id, "attacker");
    assert.equal(
      room.gameActionRecord.actionRecords.some(
        (record) => record.action === "enemyReachedBase"
      ),
      true
    );
  });

  it("rejects negative update deltas and detects game over", () => {
    const owner = createFakeSocket({ connectionID: "UPDATEOWNER00001" });
    (globalThis as any).sockets.push(owner.socket);
    const room = createSingleplayerRoom(
      owner.socket,
      GameMode.StandardSingleplayer
    );
    room.addMember(owner.socket);
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.StandardSingleplayer
    );
    data.enemies = [new Enemy(1, "1", 0, 0.5, 0.1, "stationary")];
    room.gameData = [data];

    updateSingleplayerRoomData(room, -100);
    assert.equal(data.enemies[0].sPosition, 0.5);

    const gameOver = sinon.stub(room, "startGameOverProcess").resolves();
    data.baseHealth = 0;
    updateSingleplayerRoomData(room, 0);
    assert.equal(gameOver.calledOnceWith(data), true);
    assert.equal(
      room.gameActionRecord.actionRecords.some(
        (record) => record.action === "gameOver"
      ),
      true
    );
  });
});
