import _ from "lodash";
import { changeScreen, renderGameData } from "./game";
import { resetClientSideVariables } from "./rendering";
import { Enemy } from "./enemies";

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
  const replayGameData: { [key: string]: any } = {
    commands: {},
    aborted: false
  };
  const dataLength = data.actionRecords.length;

  // TODO: actionNumber == 0 ?
  // FIXME: also get mode from server (this is a placeholder)
  replayGameData.mode = "standardSingleplayer";

  for (let actionNumber = 0; actionNumber < dataLength; actionNumber++) {
    if (actionNumber > 0) {
      const deltaTime =
        data.actionRecords[actionNumber].timestamp -
        data.actionRecords[actionNumber - 1].timestamp;
      await sleep(deltaTime);
    }
    updateReplayGameData(replayGameData, data, actionNumber);
    console.log(replayGameData);
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
      replayGameData.enemies.push(enemyData);
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
      changeScreen("archiveMenu");
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
      const apm =
        (statistics.actionsPerformed / statistics.timeInMilliseconds) * 60000;
      let text = ``;
      text += `${data.name}\n`;
      text += `Score: ${statistics.score}\n`;
      text += `Enemies: ${statistics.enemiesKilled}/${statistics.enemiesCreated}\n`;
      text += `Actions Per Minute: ${apm.toFixed(3)}\n`;
      text += `Replay Upload Time: ${statistics.scoreSubmissionDateAndTime}`;
      return text;
    }
    case "defaultMultiplayer": {
      return "";
    }
  }
  return "";
}

export { fetchReplay, playReplay, Replay, formatReplayStatisticsText };
