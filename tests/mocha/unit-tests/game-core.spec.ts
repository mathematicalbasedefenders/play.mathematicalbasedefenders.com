import assert from "node:assert/strict";
import {
  CustomSingleplayerGameData,
  GameMode,
  MultiplayerGameData,
  SingleplayerGameData,
  GAME_DATA_CONSTANTS
} from "../../../server/src/game/GameData";
import {
  Enemy,
  getEnemyAttributesBasedOnGameData
} from "../../../server/src/game/Enemy";
import {
  getInputInformation,
  InputAction,
  processInputInformation
} from "../../../server/src/core/input";
import {
  calculateAPM,
  formatNumber,
  getRank,
  millisecondsToTime,
  validateCustomGameSettings
} from "../../../server/src/core/utilities";
import { WebSocketRateLimit } from "../../../server/src/core/rate-limiting";
import { createFakeSocket } from "../utilities";

const customSettings = {
  baseHealth: 250,
  comboTime: 8000,
  enemySpeedCoefficient: 2,
  enemySpawnTime: 75,
  enemySpawnThreshold: 0.25,
  forcedEnemySpawnTime: 2000
};

describe("Game and core primitives", () => {
  beforeEach(() => {
    (globalThis as any).rooms = [];
    (globalThis as any).sockets = [];
  });

  it("initializes Easy and Standard game data with mode-specific values", () => {
    const easyOwner = createFakeSocket({ connectionID: "EASYCONNECTION01" });
    const standardOwner = createFakeSocket({
      connectionID: "STANDARDCONNECT1"
    });
    (globalThis as any).sockets.push(easyOwner.socket, standardOwner.socket);

    const easy = new SingleplayerGameData(
      easyOwner.socket,
      GameMode.EasySingleplayer
    );
    const standard = new SingleplayerGameData(
      standardOwner.socket,
      GameMode.StandardSingleplayer
    );

    assert.equal(easy.baseHealth, GAME_DATA_CONSTANTS.INITIAL_BASE_HEALTH);
    assert.equal(easy.combo, -1);
    assert.equal(easy.level, 1);
    assert.equal(easy.clocks.enemySpawn.actionTime, 150);
    assert.equal(easy.enemySpeedCoefficient, 0.5);
    assert.equal(easy.enemySpawnThreshold, 0.075);
    assert.equal(standard.clocks.enemySpawn.actionTime, 100);
    assert.equal(standard.enemySpeedCoefficient, 1);
    assert.equal(standard.enemySpawnThreshold, 0.1);
  });

  it("rejects game-data constructors used with the wrong mode", () => {
    const { socket } = createFakeSocket();

    assert.throws(
      () => new SingleplayerGameData(socket, GameMode.CustomSingleplayer),
      /Non-Singleplayer mode/
    );
    assert.throws(
      () =>
        new CustomSingleplayerGameData(
          socket,
          GameMode.EasySingleplayer,
          customSettings
        ),
      /Non-custom singleplayer game mode/
    );
    assert.throws(
      () => new MultiplayerGameData(socket, GameMode.StandardSingleplayer),
      /Non-multiplayer game mode/
    );
  });

  it("applies custom settings to custom singleplayer and multiplayer data", () => {
    const singleOwner = createFakeSocket({ connectionID: "CUSTOMSINGLE0001" });
    const multiOwner = createFakeSocket({ connectionID: "CUSTOMMULTI00001" });
    (globalThis as any).sockets.push(singleOwner.socket, multiOwner.socket);

    const single = new CustomSingleplayerGameData(
      singleOwner.socket,
      GameMode.CustomSingleplayer,
      customSettings
    );
    const multiplayer = new MultiplayerGameData(
      multiOwner.socket,
      GameMode.CustomMultiplayer
    );
    multiplayer.setValuesToCustomSettings(customSettings);

    for (const data of [single, multiplayer]) {
      assert.equal(data.baseHealth, 250);
      assert.equal(data.maximumBaseHealth, 250);
      assert.equal(data.clocks.comboReset.actionTime, 8000);
      assert.equal(data.enemySpeedCoefficient, 2);
      assert.equal(data.clocks.enemySpawn.actionTime, 75);
      assert.equal(data.enemySpawnThreshold, 0.25);
      assert.equal(data.clocks.forcedEnemySpawn.actionTime, 2000);
    }
  });

  it("edits and clears player input while enforcing the length limit", () => {
    const owner = createFakeSocket({ connectionID: "INPUTCONNECTION01" });
    (globalThis as any).sockets.push(owner.socket);
    const data = new SingleplayerGameData(
      owner.socket,
      GameMode.EasySingleplayer
    );

    for (let index = 0; index < 10; index++) {
      data.addDigitToGameDataInput({
        action: InputAction.AddDigit,
        argument: index.toString()
      });
    }
    assert.equal(data.currentInput, "01234567");

    data.removeDigitFromGameDataInput();
    data.addSubtractionSignToGameDataInput();
    assert.equal(data.currentInput, "0123456-");

    data.clearInput();
    assert.equal(data.currentInput, "");
    assert.deepEqual(owner.sentMessages.at(-1), {
      message: "clearInput",
      data: { toClear: "0123456-" }
    });

    data.removeDigitFromGameDataInput();
    assert.equal(data.currentInput, "");
  });

  it("progresses levels and clamps base-health regeneration", () => {
    const easy = new SingleplayerGameData(
      createFakeSocket().socket,
      GameMode.EasySingleplayer
    );
    const originalSpawnTime = easy.clocks.enemySpawn.actionTime;

    easy.increaseLevel(1);
    assert.equal(easy.level, 2);
    assert.equal(
      easy.clocks.enemySpawn.actionTime,
      originalSpawnTime *
        GAME_DATA_CONSTANTS.ENEMY_SPAWN_ACTION_TIME_MULTIPLIER_ON_LEVEL_UP
    );
    assert.equal(easy.enemySpeedCoefficient, 0.525);
    assert.equal(easy.baseHealthRegeneration, 1.95);
    assert.equal(
      easy.enemiesToNextLevel,
      GAME_DATA_CONSTANTS.ENEMIES_PER_LEVEL
    );

    easy.increaseLevel(100);
    assert.equal(easy.baseHealthRegeneration, 0.2);

    const standard = new SingleplayerGameData(
      createFakeSocket().socket,
      GameMode.StandardSingleplayer
    );
    standard.increaseLevel(100);
    assert.equal(standard.baseHealthRegeneration, 0.1);
  });

  it("maps supported keyboard codes and processes their actions", () => {
    assert.deepEqual(getInputInformation("Digit4"), {
      action: InputAction.AddDigit,
      argument: "4"
    });
    assert.deepEqual(getInputInformation("Numpad7"), {
      action: InputAction.AddDigit,
      argument: "7"
    });
    assert.equal(
      getInputInformation("Backspace").action,
      InputAction.RemoveDigit
    );
    assert.equal(getInputInformation("Enter").action, InputAction.SendAnswer);
    assert.equal(
      getInputInformation("NumpadSubtract").action,
      InputAction.AddSubtractionSign
    );
    assert.equal(getInputInformation("Escape").action, InputAction.AbortGame);
    assert.equal(getInputInformation("KeyA").action, InputAction.Unknown);

    const data = new SingleplayerGameData(
      createFakeSocket().socket,
      GameMode.StandardSingleplayer
    );
    processInputInformation(getInputInformation("Digit4"), data);
    processInputInformation(getInputInformation("Minus"), data);
    processInputInformation(getInputInformation("Backspace"), data);
    processInputInformation(getInputInformation("Escape"), data);

    assert.equal(data.currentInput, "4");
    assert.equal(data.aborted, true);
    assert.equal(data.actionsPerformed, 4);
  });

  it("moves, checks, and scores enemies deterministically", () => {
    const enemy = new Enemy(12, "6 + 6", 0.5, 1, 0.1, "enemy-1");

    assert.equal(enemy.check(12), true);
    assert.equal(enemy.check(11), false);
    enemy.move();
    assert.equal(enemy.sPosition, 0.9);
    enemy.move(0.25);
    assert.equal(enemy.sPosition, 0.65);

    enemy.sPosition = 0.5;
    assert.equal(enemy.calculateScore(1, 0, 1), 100);
    enemy.sPosition = 1;
    assert.equal(enemy.calculateScore(1, 2, 3), 156);
    enemy.sPosition = 0.71;
    assert.equal(enemy.calculateSent(1, 5), 4);
  });

  it("removes enemies and applies score, combo, and base damage", () => {
    const data = new SingleplayerGameData(
      createFakeSocket().socket,
      GameMode.EasySingleplayer
    );
    const killed = new Enemy(1, "1", 0, 0.5, 0.1, "killed");
    data.enemies.push(killed);

    killed.kill(data, true, true);
    assert.equal(data.enemies.length, 0);
    assert.equal(data.score, 100);
    assert.equal(data.combo, 0);
    assert.deepEqual(data.enemiesToErase, ["killed"]);

    const damaging = new Enemy(2, "2", 0, 0.5, 0.1, "damaging");
    data.enemies.push(damaging);
    damaging.attackBase(data, 25);
    assert.equal(data.baseHealth, 75);
    assert.equal(data.enemies.length, 0);
    assert.deepEqual(data.enemiesToErase, ["killed", "damaging"]);
  });

  it("derives and clamps enemy number ranges by game mode", () => {
    const easy = new SingleplayerGameData(
      createFakeSocket().socket,
      GameMode.EasySingleplayer
    );
    easy.level = 100;
    assert.deepEqual(getEnemyAttributesBasedOnGameData(easy), {
      low: -100,
      high: 100
    });

    const standard = new SingleplayerGameData(
      createFakeSocket().socket,
      GameMode.StandardSingleplayer
    );
    standard.level = 5;
    assert.deepEqual(getEnemyAttributesBasedOnGameData(standard), {
      low: -140,
      high: 140
    });
    standard.level = 1000;
    assert.deepEqual(getEnemyAttributesBasedOnGameData(standard), {
      low: -999,
      high: 999
    });

    const multiplayer = new MultiplayerGameData(
      createFakeSocket().socket,
      GameMode.DefaultMultiplayer
    );
    multiplayer.elapsedTime = 2500;
    assert.deepEqual(getEnemyAttributesBasedOnGameData(multiplayer), {
      low: -102,
      high: 102
    });
  });

  it("validates custom settings and formats game statistics", () => {
    assert.deepEqual(
      validateCustomGameSettings("singleplayer", customSettings),
      { success: true }
    );
    const invalid = validateCustomGameSettings("singleplayer", {
      ...customSettings,
      baseHealth: 0,
      enemySpawnTime: 60001
    });
    assert.equal(invalid.success, false);
    assert.match(invalid.reason ?? "", /baseHealth/);
    assert.match(invalid.reason ?? "", /enemySpawnTime/);
    assert.deepEqual(validateCustomGameSettings("unknown", customSettings), {
      success: false,
      reason: "Unknown mode: unknown"
    });

    assert.equal(millisecondsToTime(61005), "1:01.005");
    assert.equal(calculateAPM(30, 60000), 30);
    assert.equal(formatNumber(1234.5), "1,234.500");
  });

  it("uses rank precedence and enforces per-socket rate limits", () => {
    assert.deepEqual(getRank(undefined), { title: "", color: "#ffffff" });
    assert.deepEqual(getRank("Special"), {
      title: "Special",
      color: "#ffffff"
    });
    assert.deepEqual(
      getRank({
        membership: {
          isDeveloper: false,
          isAdministrator: false,
          isModerator: true,
          isContributor: true,
          isTester: false,
          isDonator: false
        }
      } as any),
      { title: "Moderator", color: "#ff7f00" }
    );

    const fake = createFakeSocket({
      rateLimiting: { last: Date.now(), count: 0 }
    });
    const limit = WebSocketRateLimit(2, 1000);
    assert.equal(limit(fake.socket), false);
    assert.equal(limit(fake.socket), false);
    assert.equal(limit(fake.socket), true);
  });
});
