import { changeScreen, renderGameData } from "./game";
import { resetClientSideVariables } from "./rendering";

interface Replay {
  ok: boolean;
  reason: string;
  data: { [key: string]: any };
}

async function fetchReplay(replayID: string) {
  const location = window.location;
  const port = location.protocol === "http:" ? ":4000" : "";
  const host = `${location.protocol}//${location.hostname}${port}/api/replays/${replayID}`;
  const data = await fetch(host);
  return data;
}

function playReplay(replayData: Replay) {
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
      break;
    }
    case "submit": {
      break;
    }
    case "enemyKill": {
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
      replayGameData[actionRecord.data.key] = actionRecord.data.value;
      break;
    }
  }
}

export { fetchReplay, playReplay, Replay };
