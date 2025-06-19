import { variables } from ".";
import { ActionRecord, Replay } from "./replay";

interface ReplayEnemyContext {
  ignored: Array<string>;
  ages: { [key: string]: number };
}

interface ReplayContext {
  enemies: ReplayEnemyContext;
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
      console.log("new destination after -5", destination);
      jumpToTimeInReplay(destination);
      break;
    }
    case "ArrowRight": {
      const TO_JUMP = 5 * 1000;
      const destination = Math.min(
        variables.replay.inGameReplayTime,
        variables.replay.elapsedReplayTime + TO_JUMP
      );
      console.log("new destination after +5", destination);
      variables.replay.elapsedReplayTime = destination;
      jumpToTimeInReplay(destination);
      break;
    }
  }
}

/**
 * Jumps to a specific replay time on a replay.
 * @param {number} destination The time since start in milliseconds.
 */
function jumpToTimeInReplay(destination: number) {
  variables.replay.elapsedReplayTime = destination;
  variables.replay.jumped = true;
}

/**
 * Gets additional replay context
 * TODO: Expand what the above sentence means.
 * @param actionRecords
 * @param actionNumbers
 * @param time Current time of the replay
 */
function getReplayContext(
  actionRecords: Array<ActionRecord>,
  actionNumbers: Array<number>,
  time: number
) {
  const context: ReplayContext = {
    enemies: {
      ignored: [],
      ages: {}
    }
  };
  context.enemies = getEnemiesReplayContext(actionRecords, actionNumbers, time);
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
    ages: {}
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
  }
  return enemies;
}

export { controlReplay, getReplayContext, ReplayContext };
