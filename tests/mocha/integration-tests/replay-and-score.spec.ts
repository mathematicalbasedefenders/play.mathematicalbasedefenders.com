import assert from "node:assert/strict";
import mongoose from "mongoose";
import sinon from "sinon";
import {
  Action,
  GameActionRecord as ReplayRecorder
} from "../../../server/src/replay/recording/ActionRecord";
import { GameActionRecord } from "../../../server/src/models/GameActionRecord";
import {
  CustomSingleplayerGameData,
  GameMode,
  SingleplayerGameData
} from "../../../server/src/game/GameData";
import { Enemy } from "../../../server/src/game/Enemy";
import {
  addToStatistics,
  submitSingleplayerGame
} from "../../../server/src/services/score";
import { User } from "../../../server/src/models/User";
import * as universal from "../../../server/src/universal";
import { createFakeSocket, createTestUser } from "../utilities";

const customSettings = {
  baseHealth: 100,
  comboTime: 5000,
  enemySpeedCoefficient: 1,
  enemySpawnTime: 100,
  enemySpawnThreshold: 0.1,
  forcedEnemySpawnTime: 2500
};

describe("Replay recording and score submission", function () {
  this.timeout(6000);
  let databaseConnection: mongoose.Mongoose;
  const originalWebhookURL = process.env.DISCORD_WEBHOOK_URL;

  before(async () => {
    databaseConnection = await mongoose.connect(process.env.MONGO_URI ?? "");
  });

  beforeEach(async () => {
    await databaseConnection.connection.db.dropDatabase();
    (globalThis as any).rooms = [];
    (globalThis as any).sockets = [];
    universal.STATUS.databaseAvailable = true;
    delete process.env.DISCORD_WEBHOOK_URL;
  });

  afterEach(() => {
    sinon.restore();
    if (originalWebhookURL === undefined) {
      delete process.env.DISCORD_WEBHOOK_URL;
    } else {
      process.env.DISCORD_WEBHOOK_URL = originalWebhookURL;
    }
  });

  it("initializes a replay and records player actions with stable shapes", () => {
    const clock = sinon.useFakeTimers(new Date("2024-01-01T00:00:00.000Z"));
    const owner = createFakeSocket({
      connectionID: "REPLAYCONNECTION1",
      loggedIn: true,
      ownerUserID: new mongoose.Types.ObjectId().toString(),
      ownerUsername: "replay-user"
    });
    (globalThis as any).sockets.push(owner.socket);
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.EasySingleplayer
    );
    const enemy = new Enemy(4, "2 + 2", 0.25, 0.75, 0.1, "enemy-id");
    const recorder = new ReplayRecorder();
    recorder.addAction({
      scope: "room",
      action: Action.GameOver,
      timestamp: 1,
      data: {}
    });

    recorder.initialize();
    recorder.addEnemySpawnAction(enemy, data);
    recorder.addEnemyKillAction(enemy, data);
    recorder.addSetGameDataAction(data, "player", "score", 100);
    recorder.addGameOverAction();

    assert.equal(recorder.actionRecords.length, 5);
    assert.deepEqual(recorder.actionRecords[0], {
      scope: "room",
      action: Action.GameStart,
      timestamp: Date.now(),
      data: {}
    });
    assert.deepEqual(recorder.actionRecords[1], {
      scope: "player",
      action: Action.EnemySpawn,
      user: {
        userID: owner.userData.ownerUserID,
        name: "replay-user",
        isAuthenticated: true,
        connectionID: "REPLAYCONNECTION1"
      },
      timestamp: Date.now(),
      data: {
        xPosition: 0.25,
        sPosition: 0.75,
        speed: 0.1,
        displayedText: "2 + 2",
        enemyID: "enemy-id"
      }
    });
    assert.equal(recorder.actionRecords[2].action, Action.EnemyKill);
    assert.deepEqual(recorder.actionRecords[3].data, {
      key: "score",
      value: 100
    });
    assert.equal(recorder.actionRecords[4].action, Action.GameOver);
    clock.restore();
  });

  it("refuses to save a replay owned by a guest", async () => {
    const owner = createFakeSocket({ loggedIn: false });
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.EasySingleplayer
    );
    const recorder = new ReplayRecorder();
    recorder.owner = owner.socket;

    assert.deepEqual(await recorder.save(data.mode, data), {
      ok: false,
      id: ""
    });
    assert.equal(await GameActionRecord.countDocuments(), 0);
  });

  it("persists an authenticated singleplayer replay and statistics", async () => {
    const user = await createTestUser({ username: "replay-player" });
    const owner = createFakeSocket({
      connectionID: "SAVEREPLAYCONN01",
      loggedIn: true,
      ownerUserID: user._id.toString(),
      ownerUsername: user.username
    });
    (globalThis as any).sockets.push(owner.socket);
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.StandardSingleplayer
    );
    Object.assign(data, {
      score: 4321,
      elapsedTime: 90000,
      enemiesSpawned: 25,
      enemiesKilled: 20,
      actionsPerformed: 80
    });
    const recorder = new ReplayRecorder();
    recorder.owner = owner.socket;
    recorder.initialize();

    const result = await recorder.save(data.mode, data);
    const saved = await GameActionRecord.findById(result.id).lean();

    assert.equal(result.ok, true);
    assert.equal(saved?.owner?.toString(), user._id.toString());
    assert.equal(saved?.mode, GameMode.StandardSingleplayer);
    assert.equal(saved?.recordingVersion, 1);
    assert.equal(saved?.statistics.singleplayer?.score, 4321);
    assert.equal(saved?.statistics.singleplayer?.timeInMilliseconds, 90000);
    assert.equal(saved?.statistics.singleplayer?.enemiesKilled, 20);
    assert.equal(saved?.actionRecords[0].action, Action.GameStart);
  });

  it("persists default multiplayer ranking data", async () => {
    const user = await createTestUser({ username: "multiplayer-recorder" });
    const owner = createFakeSocket({
      loggedIn: true,
      ownerUserID: user._id.toString(),
      ownerUsername: user.username
    });
    const recorder = new ReplayRecorder();
    recorder.owner = owner.socket;
    recorder.initialize();
    const ranking = [{ name: "Winner", placement: 1, time: 12345 }];

    const result = await recorder.save(GameMode.DefaultMultiplayer, ranking);
    const saved = await GameActionRecord.findById(result.id).lean();

    assert.equal(result.ok, true);
    assert.deepEqual(saved?.statistics.multiplayer?.ranking, ranking);
  });

  it("does not submit scores for custom or unknown game modes", async () => {
    const owner = createFakeSocket();
    const custom = new CustomSingleplayerGameData(
      owner.socket,
      GameMode.CustomSingleplayer,
      customSettings
    );
    const recorder = { save: sinon.fake.resolves({ ok: true, id: "unused" }) };

    await submitSingleplayerGame(custom, owner.socket, recorder as any);
    assert.match(owner.sentMessages.at(-1).value, /Custom Mode/);

    const unknown = new SingleplayerGameData(
      owner.socket,
      GameMode.EasySingleplayer
    );
    unknown.mode = "unknown-mode";
    await submitSingleplayerGame(unknown, owner.socket, recorder as any);
    assert.match(owner.sentMessages.at(-1).value, /unknown mode/);
    assert.equal(recorder.save.callCount, 0);
  });

  it("does not submit a score when the database is unavailable", async () => {
    const owner = createFakeSocket({ loggedIn: true });
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.EasySingleplayer
    );
    const recorder = { save: sinon.fake.resolves({ ok: true, id: "unused" }) };
    universal.STATUS.databaseAvailable = false;

    await submitSingleplayerGame(data, owner.socket, recorder as any);

    assert.deepEqual(owner.sentMessages.at(-1), {
      message: "changeText",
      selector: "#main-content__game-over-screen__stats__score-rank",
      value: "Score not saved. (No database)"
    });
    assert.equal(recorder.save.callCount, 0);
  });

  it("does not submit a guest score", async () => {
    const owner = createFakeSocket({ loggedIn: false });
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.StandardSingleplayer
    );
    data.score = 500;
    const recorder = { save: sinon.fake.resolves({ ok: true, id: "unused" }) };

    await submitSingleplayerGame(data, owner.socket, recorder as any);

    assert.match(owner.sentMessages.at(-1).value, /Played as a guest/);
    assert.equal(recorder.save.callCount, 0);
  });

  it("calculates mode-specific experience and increments games played", async () => {
    const expStub = sinon
      .stub(User, "giveExperiencePointsToUserID")
      .resolves();
    const gamesStub = sinon.stub(User, "addGamesPlayedToUserID").resolves();
    const owner = createFakeSocket({ ownerUserID: "user-id" });
    const easy = new SingleplayerGameData(
      owner.socket,
      GameMode.EasySingleplayer
    );
    easy.score = 550;

    await addToStatistics(owner.socket, easy);
    assert.equal(expStub.calledWith("user-id", 2), true);
    assert.equal(gamesStub.calledWith("user-id", 1), true);

    expStub.resetHistory();
    gamesStub.resetHistory();
    const standard = new SingleplayerGameData(
      owner.socket,
      GameMode.StandardSingleplayer
    );
    standard.score = 550;
    await addToStatistics(owner.socket, standard);
    assert.equal(expStub.calledWith("user-id", 6), true);
    assert.equal(gamesStub.calledWith("user-id", 1), true);
  });

  it("saves an authenticated personal best and reports its rank", async () => {
    const user = await createTestUser({
      username: "score-player",
      statistics: {
        personalBestScoreOnStandardSingleplayerMode: { score: 100 }
      }
    });
    const owner = createFakeSocket({
      connectionID: "SCORECONNECTION01",
      loggedIn: true,
      ownerUserID: user._id.toString(),
      ownerUsername: user.username,
      ownerGuestName: "Guest 12345678"
    });
    (globalThis as any).sockets.push(owner.socket);
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.StandardSingleplayer
    );
    Object.assign(data, {
      score: 1000,
      elapsedTime: 60000,
      enemiesSpawned: 15,
      enemiesKilled: 12,
      actionsPerformed: 30
    });
    const recorder = new ReplayRecorder();
    recorder.owner = owner.socket;
    recorder.initialize();

    await submitSingleplayerGame(data, owner.socket, recorder);

    const updated = await User.safeFindByUserID(user._id.toString());
    const personalBest =
      updated.statistics.personalBestScoreOnStandardSingleplayerMode;
    assert.equal(personalBest.score, 1000);
    assert.equal(personalBest.timeInMilliseconds, 60000);
    assert.equal(personalBest.enemiesKilled, 12);
    assert.ok(personalBest.replayID);
    assert.equal(await GameActionRecord.countDocuments(), 1);

    const replayMessage = owner.sentMessages.find(
      (message) =>
        message.selector ===
        "#main-content__game-over-screen__stats__score-replay-id"
    );
    const rankMessage = owner.sentMessages.find(
      (message) =>
        message.selector ===
        "#main-content__game-over-screen__stats__score-rank"
    );
    assert.match(replayMessage.value, /Replay saved with ID/);
    assert.equal(rankMessage.value, "Personal Best! Global Rank #1");
    assert.equal(
      owner.sentMessages.some(
        (message) => message.message === "updateUserInformationText"
      ),
      true
    );
  });

  after(async () => {
    await databaseConnection.connection.close();
  });
});
