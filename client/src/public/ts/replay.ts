import _ from "lodash";
import { changeScreen, renderGameData } from "./game";
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

const replayGameData: { [key: string]: any } = {};
interface Replay {
  ok: boolean;
  reason: string;
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
  "Subtract": "-"
};

async function fetchReplay(replayID: string) {
  const location = window.location;
  const port = location.protocol === "http:" ? ":4000" : "";
  const host = `${location.protocol}//${location.hostname}${port}/api/replays/${replayID}`;
  const data = await fetch(host);
  return data;
}

async function playReplay(replayData: Replay, viewAs?: string) {
  const data = replayData.data;
  changeScreen("canvas", true, true);
  variables.watchingReplay = true;
  replayGameData.commands = {};
  replayGameData.aborted = false;
  const dataLength = data.actionRecords.length;

  // TODO: actionNumber == 0 ?
  replayGameData.mode = data.mode;

  // only for multiplayer
  replayGameData.viewAs = viewAs ?? "";

  for (let actionNumber = 0; actionNumber < dataLength; actionNumber++) {
    if (!variables.watchingReplay) {
      replayGameData.enemies = [];
      replayGameData.enemiesToErase = [];
      changeScreen("archiveMenu", true, true);
      Opponent.destroyAllInstances();
      deleteAllEnemies();
      break;
    }
    if (actionNumber > 0) {
      const deltaTime =
        data.actionRecords[actionNumber].timestamp -
        data.actionRecords[actionNumber - 1].timestamp;
      await sleep(deltaTime);
      // also add to clocks
    }
    updateReplayGameData(replayGameData, data, actionNumber);
  }
}

function updateReplayGameData(
  replayGameData: { [key: string]: any },
  data: { [key: string]: any },
  actionNumber: number
) {
  // set time

  if (actionNumber === 0) {
    replayGameData.elapsedTime = 0;
  } else {
    replayGameData.elapsedTime +=
      data.actionRecords[actionNumber].timestamp -
      data.actionRecords[actionNumber - 1].timestamp;
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
      updateOpponentGameData(actionRecord, replayGameData);
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
      // enemy killed = input correct, so remove
      replayGameData.currentInput = "";
      replayGameData.enemiesToErase.push(actionRecord.data.enemyID);
      // add enemy killed
      replayGameData.enemiesKilled++;
      // reset combo time
      replayGameData.clocks.comboReset.currentTime = 0;
      // add combo
      replayGameData.combo++;
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
    case "enemyReachedBase": {
      break;
    }
    case "gameStart": {
      resetClientSideVariables();
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
      break;
    }
    case "gameOver": {
      // "kill" (remove) all enemies to prevent enemies overflowing
      replayGameData.enemies = [];
      replayGameData.enemiesToErase = [];
      variables.watchingReplay = false;
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
function updateOpponentGameData(actionRecord: any, replayGameData: any) {
  const connectionID = actionRecord.user.connectionID;
  const opponentData = replayGameData.opponentGameData.find(
    (element: any) => element.owner === connectionID
  );
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
  replayGameData.clocks.comboReset.currentTime += deltaTime;
  // opponents
  const opponentGameData = replayGameData.opponentGameData;
  for (const opponentData of opponentGameData) {
    // enemies
    for (const enemy of opponentData.enemies) {
      enemy.sPosition -= (deltaTime / 1000) * enemy.speed;
    }
  }
}

export {
  fetchReplay,
  playReplay,
  Replay,
  formatReplayStatisticsText,
  getPlayerListOptions,
  updateReplayGameDataLikeServer,
  replayGameData
};
