import _ from "lodash";
import { changeScreen } from "./game";
import { resetClientSideVariables } from "./rendering";
import {
  Enemy,
  getScaledEnemyHeight,
  getScaledEnemyWidth,
  deleteAllEnemies
} from "./enemies";
import { variables } from ".";
import { formatNumber, millisecondsToTime } from "./utilities";
import { Opponent } from "./opponent";
import { ToastNotification } from "./toast-notification";
import { getReplayContext, ReplayContext } from "./replay-control";

const replayGameData: { [key: string]: any } = {};

interface Replay {
  ok: boolean;
  reason: string;
  data: {
    _id: string;
    mode: string;
    actionRecords: Array<ActionRecord>;
    statistics: {
      singleplayer: { [key: string]: any };
      multiplayer: { [key: string]: any };
    };
  } & { [key: string]: any };
}

interface ActionRecord {
  scope: "room" | "player";
  user?: {
    userID: string | null | undefined;
    name: string | undefined;
    isAuthenticated: boolean | undefined;
    connectionID: string | undefined;
  };
  action: string;
  timestamp: number;
  data: { [key: string]: any };
}

const KEY_MAPPINGS: { [key: string]: string } = {
  "Digit0": "0",
  "Digit1": "1",
  "Digit2": "2",
  "Digit3": "3",
  "Digit4": "4",
  "Digit5": "5",
  "Digit6": "6",
  "Digit7": "7",
  "Digit8": "8",
  "Digit9": "9",
  "Numpad0": "0",
  "Numpad1": "1",
  "Numpad2": "2",
  "Numpad3": "3",
  "Numpad4": "4",
  "Numpad5": "5",
  "Numpad6": "6",
  "Numpad7": "7",
  "Numpad8": "8",
  "Numpad9": "9",
  "Minus": "-",
  "NumpadSubtract": "-"
};

async function fetchReplay(replayID: string) {
  const location = window.location;
  const port = location.protocol === "http:" ? ":4000" : "";
  const host = `${location.protocol}//${location.hostname}${port}/api/replays/${replayID}`;
  const replayData = await fetch(host);
  if (!replayData.ok) {
    const options = { borderColor: "#ff0000" };
    const toast = new ToastNotification(
      `Replay fetching error: Error Code ${replayData.status}`,
      options
    );
    toast.render();
    console.error(`Replay fetching error: `, `Error Code ${replayData.status}`);
    $("#main-content__archive-screen-container__content__replay-details").hide(
      0
    );
    return;
  }
  return replayData;
}

async function playReplay(replayData: Replay, viewAs?: string) {
  const INTERVAL = 1000 / 60;

  const data = replayData.data;
  changeScreen("canvas", true, true);

  replayGameData.commands = {};
  replayGameData.aborted = false;
  const dataLength = data.actionRecords.length;

  // TODO: actionNumber == 0 ?
  replayGameData.mode = data.mode;

  // only for multiplayer
  replayGameData.viewAs = viewAs ?? "";

  // initialize starting timestamp
  const startingActionRecord = data.actionRecords.find(
    (element: ActionRecord) => element.action === "gameStart"
  ) as ActionRecord;
  const startingTimestamp = startingActionRecord.timestamp;
  variables.replay.elapsedReplayTime = 0;

  /* "Initialize" replay by initializing variables 
  (action record at index 0 is always gameStart) */
  const inGameTime = getInGameTime(replayData);
  updateReplayGameData(replayGameData, data, 0);
  variables.replay.inGameReplayTime = inGameTime;

  /* Start replay (this variable assignment puts the game in "replay viewing" mode) */
  variables.replay.watchingReplay = true;

  while (variables.replay.elapsedReplayTime <= inGameTime) {
    let timestamp = startingTimestamp + variables.replay.elapsedReplayTime;
    let timestampWindow = INTERVAL;
    let additionalReplayContext: ReplayContext = {
      enemies: {
        ignored: [],
        ages: {}
      }
    };

    if (variables.replay.jumped) {
      resetClientSideVariables();
      resetReplayGameData(replayGameData);
      // set variables
      variables.currentGameClientSide.totalElapsedMilliseconds =
        variables.replay.elapsedReplayTime;
      replayGameData.elapsedTime = variables.replay.elapsedReplayTime;
      clearReplayScreen();
      timestamp = startingTimestamp;
      timestampWindow = variables.replay.elapsedReplayTime;
      variables.replay.jumped = false;
      variables.replay.finishedJumping = true;
    }

    const actionNumbers = getActionNumbers(
      data.actionRecords,
      timestamp,
      timestampWindow
    );

    if (variables.replay.finishedJumping) {
      additionalReplayContext = getReplayContext(
        data.actionRecords,
        actionNumbers,
        variables.replay.elapsedReplayTime
      );
    }

    if (!variables.replay.watchingReplay) {
      stopReplay();
      break;
    }

    for (const actionNumber of actionNumbers) {
      if (actionNumber >= dataLength) {
        stopReplay();
        break;
      }
      if (variables.replay.finishedJumping) {
        updateReplayGameData(
          replayGameData,
          data,
          actionNumber,
          additionalReplayContext
        );
      } else {
        updateReplayGameData(replayGameData, data, actionNumber);
      }
    }

    await sleep(INTERVAL);
    variables.replay.elapsedReplayTime += INTERVAL;
    variables.replay.finishedJumping = false;
  }
}

/**
 * Gets every action number where the action has timestamp
 * in the range `[timestamp, timestamp+limit)`
 * @param {number} timestamp The timestamp
 * @param {number} limit How way off the timestamp is allowed to exceed by
 */
function getActionNumbers(
  actionRecords: Array<ActionRecord>,
  timestamp: number,
  limit: number
) {
  let start = 0;
  let end = 0;
  for (let current = 0; current < actionRecords.length; current++) {
    if (timestamp <= actionRecords[current].timestamp) {
      start = current;
      break;
    }
  }
  for (let current = start; current < actionRecords.length; current++) {
    if (timestamp + limit < actionRecords[current].timestamp) {
      break;
    }
    end = current;
  }
  const numbers = [];
  for (let current = start; current <= end; current++) {
    numbers.push(current);
  }
  return numbers;
}

function updateReplayGameData(
  replayGameData: { [key: string]: any },
  data: { [key: string]: any },
  actionNumber: number,
  additionalReplayContext?: ReplayContext
) {
  // set time

  if (actionNumber === 0) {
    replayGameData.elapsedTime = 0;
  } else {
    const startingActionRecord = data.actionRecords.find(
      (element: ActionRecord) => element.action === "gameStart"
    ) as ActionRecord;
    const startingTimestamp = startingActionRecord.timestamp;
    replayGameData.elapsedTime =
      data.actionRecords[actionNumber].timestamp - startingTimestamp;
  }

  const actionRecord = data.actionRecords[actionNumber];

  // returns in connectionID
  if (data.mode === "defaultMultiplayer") {
    const updateOpponent =
      getWhoseDataToUpdate(actionRecord) !== replayGameData.viewAs;
    const isAddUserAction = actionRecord.action === "addUser";
    const isRoomScoped = actionRecord.scope === "room";
    if (!isAddUserAction && updateOpponent && !isRoomScoped) {
      // update someone else...
      updateOpponentGameData(
        actionRecord,
        replayGameData,
        additionalReplayContext
      );
      return;
    }
  }

  switch (actionRecord.action) {
    case "keypress": {
      const code = actionRecord.data.code;
      if (["NumpadAdd", "Backspace", "Space"].indexOf(code) > -1) {
        replayGameData.currentInput = replayGameData.currentInput.slice(0, -1);
      } else {
        const character = KEY_MAPPINGS[code];
        if (character) {
          replayGameData.currentInput += character;
        }
      }
      break;
    }
    case "submit": {
      break;
    }
    case "enemyKill": {
      if (
        additionalReplayContext?.enemies.ignored.includes(
          actionRecord.data.enemyID
        )
      ) {
        replayGameData.currentInput = "";
        break;
      }
      // enemy killed = input correct, so remove
      replayGameData.currentInput = "";
      replayGameData.enemiesToErase.push(actionRecord.data.enemyID);
      // add enemy killed
      replayGameData.enemiesKilled++;
      // reset combo time
      replayGameData.clocks.comboReset.currentTime = 0;
      // add combo
      replayGameData.combo++;
      /** flashing input area not needed due to it already being in enemy kill code */
      // ...
      break;
    }
    case "attack": {
      break;
    }
    case "stockCancel": {
      replayGameData.receivedEnemiesStock -= actionRecord.data.amount;
      break;
    }
    case "stockAdd": {
      replayGameData.receivedEnemiesStock += actionRecord.data.amount;
      break;
    }
    case "stockRelease": {
      replayGameData.receivedEnemiesStock = 0;
      break;
    }
    case "enemyReceive": {
      const enemyData = actionRecord.data;
      const newEnemy = new Enemy(
        enemyData.sPosition,
        enemyData.displayedText,
        enemyData.id,
        getScaledEnemyWidth(),
        getScaledEnemyHeight(),
        enemyData.speed,
        enemyData.xPosition
      );
      newEnemy.render();
      break;
    }
    case "enemySpawn": {
      const enemyData = actionRecord.data;
      // replayGameData.enemies.push(enemyData);
      if (additionalReplayContext?.enemies.ignored.includes(enemyData.id)) {
        replayGameData.currentInput = "";
        break;
      }
      const newEnemy = new Enemy(
        enemyData.sPosition,
        enemyData.displayedText,
        enemyData.id,
        getScaledEnemyWidth(),
        getScaledEnemyHeight(),
        enemyData.speed,
        enemyData.xPosition
      );
      if (additionalReplayContext?.enemies.ages[enemyData.id]) {
        newEnemy.ageOffset =
          additionalReplayContext?.enemies.ages[enemyData.id];
      }
      newEnemy.render();
      break;
    }
    case "enemyReachedBase": {
      break;
    }
    case "gameStart": {
      if (variables.replay.finishedJumping) {
        break;
      }
      resetClientSideVariables();
      resetReplayGameData(replayGameData);
      break;
    }
    case "gameOver": {
      // "kill" (remove) all enemies to prevent enemies overflowing
      replayGameData.enemies = [];
      replayGameData.enemiesToErase = [];
      // stop replay
      stopReplay();
      variables.replay.watchingReplay = false;
      changeScreen("archiveMenu", true, true);
      break;
    }
    case "elimination": {
      break;
    }
    case "declareWinner": {
      break;
    }
    case "addUser": {
      if (data.mode.indexOf("Singleplayer") > -1) {
        replayGameData.owner = actionRecord.data.name;
        replayGameData.userID = actionRecord.data.userID;
        replayGameData.connectionID = actionRecord.data.connectionID;
      } else {
        // is multiplayer
        if (
          replayGameData.viewAs === actionRecord.data.playerAdded.connectionID
        ) {
          replayGameData.owner = actionRecord.data.playerAdded.name;
          replayGameData.userID = actionRecord.data.playerAdded.userID;
          replayGameData.connectionID =
            actionRecord.data.playerAdded.connectionID;
        } else {
          replayGameData.opponentGameData.push({
            baseHealth: 100,
            combo: -1,
            currentInput: "",
            receivedEnemiesStock: 0,
            owner: actionRecord.data.playerAdded.connectionID,
            ownerName: actionRecord.data.playerAdded.name,
            enemies: [],
            enemiesToErase: []
          });
        }
      }
      break;
    }
    case "setGameData": {
      _.set(replayGameData, actionRecord.data.key, actionRecord.data.value);
      break;
    }
  }
}

/**
 * Use this in multiplayer replays where the action record owner isn't the main viewer.
 * @param actionRecord
 * @param replayGameData
 */
function updateOpponentGameData(
  actionRecord: any,
  replayGameData: any,
  additionalReplayContext?: ReplayContext
) {
  const connectionID = actionRecord.user.connectionID;
  const opponentData = replayGameData.opponentGameData.find(
    (element: any) => element.owner === connectionID
  );
  if (!opponentData) {
    console.warn("Cant find opponent data, not rendering for opponent...");
    return;
  }
  switch (actionRecord.action) {
    case "keypress": {
      break;
    }
    case "submit": {
      break;
    }
    case "enemyKill": {
      opponentData.enemiesToErase.push(actionRecord.data.enemyID);
      opponentData.combo++;
      // ...
      break;
    }
    case "attack": {
      break;
    }
    case "stockCancel": {
      replayGameData.receivedEnemiesStock -= actionRecord.data.amount;
      break;
    }
    case "stockAdd": {
      opponentData.receivedEnemiesStock += actionRecord.data.amount;
      break;
    }
    case "stockRelease": {
      opponentData.receivedEnemiesStock = 0;
      break;
    }
    case "enemyReceive": {
      opponentData.enemies.push({
        requestedValue: "",
        displayedText: actionRecord.data.displayedText,
        xPosition: actionRecord.data.xPosition,
        sPosition: actionRecord.data.sPosition,
        speed: actionRecord.data.speed,
        id: actionRecord.data.id
      });
      break;
    }
    case "enemySpawn": {
      const enemyData = {
        requestedValue: "",
        displayedText: actionRecord.data.displayedText,
        xPosition: actionRecord.data.xPosition,
        sPosition: actionRecord.data.sPosition,
        speed: actionRecord.data.speed,
        id: actionRecord.data.id
      };
      opponentData.enemies.push({
        enemyData
      });
      break;
    }
    case "enemyReachedBase": {
      opponentData.enemiesToErase.push(actionRecord.data.enemyID);
      break;
    }
    case "gameStart": {
      break;
    }
    case "gameOver": {
      //TODO: this
      break;
    }
    case "elimination": {
      break;
    }
    case "declareWinner": {
      break;
    }
    case "setGameData": {
      if (actionRecord.data.key.indexOf("owner.") > -1) {
        // this messes everything up, and its already set in the main update function
        return;
      }
      _.set(opponentData, actionRecord.data.key, actionRecord.data.value);
      break;
    }
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatReplayStatisticsText(data: { [key: string]: any }) {
  switch (data.mode) {
    case "easySingleplayer":
    case "standardSingleplayer": {
      const statistics = data.statistics.singleplayer;
      const ms = statistics.timeInMilliseconds;
      const apm = (statistics.actionsPerformed / ms) * 60000;
      let text = ``;
      text += `${data.name}\n`;
      text += `Score: ${statistics.score.toLocaleString("en-US")}\n`;
      text += `Enemies: ${statistics.enemiesKilled}/${statistics.enemiesCreated}\n`;
      text += `Elapsed Time: ${millisecondsToTime(ms)}\n`;
      text += `Actions Per Minute: ${formatNumber(apm)}\n`;
      text += `Replay Upload Time: ${statistics.scoreSubmissionDateAndTime}`;
      return text;
    }
    case "defaultMultiplayer": {
      const statistics = data.statistics.multiplayer;
      let text = ``;
      text += `Multiplayer game played on ${data.timestamp} `;
      text += `with ${statistics.ranking.length} players.`;
      return text;
    }
  }
  return "";
}

function getPlayerListOptions(data: any) {
  const options = [];
  const ranking = data.statistics.multiplayer.ranking;
  ranking.sort((a: any, b: any) => b.placement - a.placement);
  let rank = 0;
  for (const player of ranking) {
    rank++;
    const playerName = player.name;
    const playerConnectionID = player.connectionID;
    const option = new Option(`${playerName} (#${rank})`, playerConnectionID);
    options.push(option);
  }
  return options;
}

function getWhoseDataToUpdate(actionRecord: any) {
  return actionRecord?.user?.connectionID ?? "";
}

/**
 * Updates the replay game data while mimicking the server's replay game data update process.
 * @param replayGameData
 * @param deltaTime
 */
function updateReplayGameDataLikeServer(deltaTime: number) {
  // clocks
  updateReplayClockData(deltaTime);
  // opponents
  updateReplayOpponentGameData(deltaTime);
}

function updateReplayClockData(deltaTime: number) {
  if (replayGameData?.clocks?.comboReset?.currentTime) {
    replayGameData.clocks.comboReset.currentTime += deltaTime;
  }
}

function updateReplayOpponentGameData(deltaTime: number) {
  const opponentGameData = replayGameData.opponentGameData;
  if (!opponentGameData) {
    return;
  }
  for (const opponentData of opponentGameData) {
    // enemies
    for (const enemy of opponentData.enemies) {
      enemy.sPosition -= (deltaTime / 1000) * enemy.speed;
    }
  }
}

function stopReplay() {
  clearReplayScreen();
  variables.replay.enemyColors = {};
  changeScreen("archiveMenu", true, true);
}

function clearReplayScreen() {
  replayGameData.enemies = [];
  replayGameData.enemiesToErase = [];
  for (const enemy in Enemy.enemiesDrawn) {
    if (Enemy.enemyCache[enemy]) {
      Enemy.enemyCache[enemy].deleteSprite();
    }
  }
  deleteAllEnemies();
  Opponent.destroyAllInstances();
}

function getInGameTime(data: Replay) {
  switch (data.data.mode) {
    case "easySingleplayer":
    case "standardSingleplayer": {
      const statistics = data.data.statistics.singleplayer;
      const ms = statistics.timeInMilliseconds;
      return ms;
    }
    case "defaultMultiplayer": {
      const statistics = data.data.statistics.multiplayer;
      if (statistics.timeInMilliseconds) {
        return statistics.timeInMilliseconds;
      } else {
        // fallback for older replays: return how long the winner lasted
        return statistics.ranking[statistics.ranking.length - 1].time;
      }
    }
  }
}

function resetReplayGameData(replayGameData: { [key: string]: any }) {
  replayGameData.score = 0;
  replayGameData.enemiesKilled = 0;
  replayGameData.enemiesSpawned = 0;
  replayGameData.baseHealth = 100;
  replayGameData.owner = {};
  replayGameData.ownerConnectionID = "";
  replayGameData.ownerName = "";
  replayGameData.enemies = [];
  replayGameData.enemiesToErase = [];
  replayGameData.currentInput = "";
  replayGameData.elapsedTime = 0;
  replayGameData.combo = -1;
  replayGameData.commands = {};
  replayGameData.aborted = false;
  replayGameData.enemiesSentStock = 0;
  replayGameData.attackScore = 0;
  replayGameData.level = 1;
  replayGameData.enemiesToNextLevel = 10;
  replayGameData.baseHealthRegeneration = 2;
  replayGameData.maximumBaseHealth = 100;
  replayGameData.actionsPerformed = 0;
  replayGameData.receivedEnemiesStock = 0;
  replayGameData.clocks = {
    enemySpawn: {
      actionTime: 0,
      currentTime: 0
    },
    comboReset: {
      actionTime: 0,
      currentTime: 0
    },
    forcedEnemySpawn: {
      actionTime: 0,
      currentTime: 0
    }
  };
  replayGameData.enemySpeedCoefficient = 1;
  replayGameData.enemySpawnThreshold = 0.1;
  replayGameData.opponentGameData = [];
}

export {
  fetchReplay,
  playReplay,
  Replay,
  formatReplayStatisticsText,
  getPlayerListOptions,
  updateReplayGameDataLikeServer,
  replayGameData,
  stopReplay,
  ActionRecord
};
