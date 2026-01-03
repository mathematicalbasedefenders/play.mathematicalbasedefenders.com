import { stageItems, variables } from ".";
import { ActionRecord, Replay } from "./replay";
import { ToastNotification } from "./toast-notification";

interface MultiplayerReplayEnemyContext {
  players?: { [key: string]: { enemies: ReplayEnemyContext } };
}

interface ReplayEnemyContext {
  ignored: Array<string>;
  ages: { [key: string]: number };
  // workaround for multiplayer replay
  spawnTimes: { [key: string]: number };
}

interface ReplayContext {
  enemies: ReplayEnemyContext;
  multiplayer?: MultiplayerReplayEnemyContext;
  actionNumbersInPeriod?: Array<number>;
}

function controlReplay(code: string) {
  switch (code) {
    case "ArrowLeft": {
      const TO_JUMP = 5 * 1000;
      const destination = Math.max(
        0,
        variables.replay.elapsedReplayTime - TO_JUMP
      );
      variables.replay.elapsedReplayTime = destination;
      jumpToTimeInReplay(destination);
      break;
    }
    case "ArrowRight": {
      const TO_JUMP = 5 * 1000;
      const destination = Math.min(
        variables.replay.inGameReplayTime,
        variables.replay.elapsedReplayTime + TO_JUMP
      );
      variables.replay.elapsedReplayTime = destination;
      jumpToTimeInReplay(destination);
      break;
    }
    case "Space": {
      if (variables.replay.paused) {
        variables.replay.paused = false;
      } else {
        variables.replay.paused = true;
        jumpToTimeInReplay(variables.replay.elapsedReplayTime);
      }
    }
  }
}

/**
 * Forces a score value/the score text to be of a certain value.
 * @param score
 */
function forceSetScore(score: number) {
  variables.currentGameClientSide.shownScore = score;
  variables.currentGameClientSide.beautifulScoreDisplayGoal = score;
  variables.currentGameClientSide.beautifulScoreDisplayProgress = score;
  variables.currentGameClientSide.beautifulScoreDisplayPrevious = score;

  if (isNaN(score)) {
    console.warn("forceSetScore received NaN value, defaulting to 0");
    stageItems.textSprites.scoreText.text = "0";
  } else {
    stageItems.textSprites.scoreText.text =
      Number.parseInt(score.toString()).toLocaleString("en-US") || "0";
  }
}

/**
 * Jumps to a specific replay time on a replay.
 * @param {number} destination The time since start in milliseconds.
 */
function jumpToTimeInReplay(destination: number) {
  variables.replay.elapsedReplayTime = destination;
  variables.replay.jumped = true;
  if (variables.replay.paused) {
    variables.replay.timestampOnPause =
      variables.replay.startingTimestamp + destination;
  }
}

function jumpToProgressInReplay(destination: number) {
  const time = variables.replay.inGameReplayTime * destination;
  jumpToTimeInReplay(time);
}

/**
 * Gets additional replay context
 * @param actionRecords The records to base the returned additional context on
 * @param actionNumbers The action number indexes to base the returned additional context on
 * @param time Current time of the replay
 */
function getReplayContext(
  actionRecords: Array<ActionRecord>,
  actionNumbers: Array<number>,
  time: number,
  replayData: { [key: string]: any }
) {
  const context: ReplayContext = {
    enemies: {
      ignored: [],
      ages: {},
      spawnTimes: {}
    }
  };
  context.enemies = getEnemiesReplayContext(actionRecords, actionNumbers, time);

  if (replayData.mode === "defaultMultiplayer") {
    const opponents = replayData.statistics.multiplayer.ranking.filter(
      (e: any) => e.connectionID !== replayData.viewAs
    );
    context.multiplayer = {};
    context.multiplayer.players = {};
    for (const opponent of opponents) {
      const connectionID = opponent.connectionID;
      context.multiplayer.players[connectionID] = {
        enemies: { ignored: [], ages: {}, spawnTimes: {} }
      };
      context.multiplayer.players[connectionID].enemies =
        getMultiplayerEnemiesReplayContext(
          connectionID,
          actionRecords,
          actionNumbers,
          time
        );
    }
  }
  return context;
}

function getEnemiesReplayContext(
  actionRecords: Array<ActionRecord>,
  actionNumbers: Array<number>,
  time: number
) {
  const aliveEnemies: {
    [key: string]: { spawnTimestamp: number; speed: number };
  } = {};
  const enemies: ReplayEnemyContext = {
    ignored: [],
    ages: {},
    spawnTimes: {}
  };
  /**
   * An enemy is ignored when it was already killed/reached base between the range of actions.
   * This way the enemy doesn't appear and mess up anything.
   */
  for (const actionNumber of actionNumbers) {
    // already killed
    if (
      actionRecords[actionNumber].action === "enemyKill" &&
      Object.keys(aliveEnemies).includes(
        actionRecords[actionNumber].data.enemyID
      )
    ) {
      enemies.ignored.push(actionRecords[actionNumber].data.enemyID);
      delete aliveEnemies[actionRecords[actionNumber].data.enemyID];
      continue;
    }
    // already reached base
    if (
      actionRecords[actionNumber].action === "enemyReachedBase" &&
      Object.keys(aliveEnemies).includes(
        actionRecords[actionNumber].data.enemyID
      )
    ) {
      enemies.ignored.push(actionRecords[actionNumber].data.enemyID);
      delete aliveEnemies[actionRecords[actionNumber].data.enemyID];
      continue;
    }
    // new spawn
    if (actionRecords[actionNumber].action === "enemySpawn") {
      aliveEnemies[actionRecords[actionNumber].data.id] = {
        spawnTimestamp: actionRecords[actionNumber].timestamp,
        speed: actionRecords[actionNumber].data.speed
      };
    }
  }
  /**
   * An enemy is moved some position down because the replay system doesn't implement it.
   * This will implement the function where the enemies "spawn" at sPosition < 1
   * This just instantly moves the enemy to sPosition in zero time.
   * TODO: This doesn't take care of when level up yet (that is, when enemy speed changes for all enemies.)
   */
  const startTimestamp = actionRecords[0].timestamp;
  for (const enemy of Object.keys(aliveEnemies)) {
    const timeElapsed =
      time - (aliveEnemies[enemy].spawnTimestamp - startTimestamp);
    enemies.ages[enemy] = timeElapsed;
    enemies.spawnTimes[enemy] =
      aliveEnemies[enemy].spawnTimestamp - startTimestamp;
  }
  return enemies;
}

function getMultiplayerEnemiesReplayContext(
  connectionID: string,
  actionRecords: Array<ActionRecord>,
  actionNumbers: Array<number>,
  time: number
) {
  const aliveEnemies: {
    [key: string]: { spawnTimestamp: number; speed: number };
  } = {};
  const enemies: ReplayEnemyContext = {
    ignored: [],
    ages: {},
    spawnTimes: {}
  };
  /**
   * An enemy is ignored when it was already killed/reached base between the range of actions.
   * This way the enemy doesn't appear and mess up anything.
   */
  for (const actionNumber of actionNumbers) {
    // already killed
    if (
      actionRecords[actionNumber].action === "enemyKill" &&
      Object.keys(aliveEnemies).includes(
        actionRecords[actionNumber].data.enemyID
      ) &&
      actionRecords[actionNumber].user?.connectionID === connectionID
    ) {
      enemies.ignored.push(actionRecords[actionNumber].data.enemyID);
      delete aliveEnemies[actionRecords[actionNumber].data.enemyID];
      continue;
    }
    // already reached base
    if (
      actionRecords[actionNumber].action === "enemyReachedBase" &&
      Object.keys(aliveEnemies).includes(
        actionRecords[actionNumber].data.enemyID
      ) &&
      actionRecords[actionNumber].user?.connectionID === connectionID
    ) {
      enemies.ignored.push(actionRecords[actionNumber].data.enemyID);
      delete aliveEnemies[actionRecords[actionNumber].data.enemyID];
      continue;
    }
    // new spawn or receive
    if (
      (actionRecords[actionNumber].action === "enemySpawn" ||
        actionRecords[actionNumber].action === "enemyReceive") &&
      actionRecords[actionNumber].user?.connectionID === connectionID
    ) {
      aliveEnemies[actionRecords[actionNumber].data.id] = {
        spawnTimestamp: actionRecords[actionNumber].timestamp,
        speed: actionRecords[actionNumber].data.speed
      };
    }
  }
  /**
   * An enemy is moved some position down because the replay system doesn't implement it.
   * This will implement the function where the enemies "spawn" at sPosition < 1
   * This just instantly moves the enemy to sPosition in zero time.
   * TODO: This doesn't take care of when level up yet (that is, when enemy speed changes for all enemies.)
   */
  const startTimestamp = actionRecords[0].timestamp;
  for (const enemy of Object.keys(aliveEnemies)) {
    const timeElapsed =
      time - (aliveEnemies[enemy].spawnTimestamp - startTimestamp);
    enemies.ages[enemy] = timeElapsed;
    enemies.spawnTimes[enemy] =
      aliveEnemies[enemy].spawnTimestamp - startTimestamp;
  }
  return enemies;
}

export {
  controlReplay,
  getReplayContext,
  ReplayContext,
  forceSetScore,
  jumpToProgressInReplay,
  jumpToTimeInReplay
};
