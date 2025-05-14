import _ from "lodash";
import { changeScreen, renderGameData } from "./game";
import { resetClientSideVariables } from "./rendering";
import { Enemy, getScaledEnemyHeight, getScaledEnemyWidth } from "./enemies";
import { variables } from ".";
import { formatNumber, millisecondsToTime } from "./utilities";

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

async function playReplay(replayData: Replay) {
  const data = replayData.data;
  changeScreen("canvas", true, true);
  variables.watchingReplay = true;
  const replayGameData: { [key: string]: any } = {
    commands: {},
    aborted: false
  };
  const dataLength = data.actionRecords.length;

  // TODO: actionNumber == 0 ?
  replayGameData.mode = data.mode;

  for (let actionNumber = 0; actionNumber < dataLength; actionNumber++) {
    if (!variables.watchingReplay) {
      replayGameData.enemies = [];
      replayGameData.enemiesToErase = [];
      changeScreen("archiveMenu", true, true);
      break;
    }
    if (actionNumber > 0) {
      const deltaTime =
        data.actionRecords[actionNumber].timestamp -
        data.actionRecords[actionNumber - 1].timestamp;
      await sleep(deltaTime);
      // also add to clocks
      replayGameData.clocks.comboReset.currentTime += deltaTime;
    }
    updateReplayGameData(replayGameData, data, actionNumber);
    renderGameData(replayGameData);
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

  switch (actionRecord.action) {
    case "keypress": {
      const code = actionRecord.data.code;
      if (["NumpadAdd", "Backspace", "Space"].indexOf(code) > -1) {
        replayGameData.currentInput = replayGameData.currentInput.slice(0, -1);
      } else {
        replayGameData.currentInput += KEY_MAPPINGS[code];
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
      break;
    }
    case "stockAdd": {
      break;
    }
    case "stockRelease": {
      break;
    }
    case "enemyReceive": {
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
      replayGameData.owner = actionRecord.data.name;
      replayGameData.userID = actionRecord.data.userID;
      break;
    }
    case "setGameData": {
      _.set(replayGameData, actionRecord.data.key, actionRecord.data.value);
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
  ranking.reverse();
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

export {
  fetchReplay,
  playReplay,
  Replay,
  formatReplayStatisticsText,
  getPlayerListOptions
};
