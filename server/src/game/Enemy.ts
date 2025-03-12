import _ from "lodash";
import { log } from "../core/log";
import {
  GameData,
  SingleplayerGameData,
  MultiplayerGameData,
  ActionRecord
} from "./GameData";
import { USE_TESTING_VALUES } from "../universal";
import { TESTING_VALUES } from "../testing-configuration/values";

const MINIMUM_GENERABLE_NUMBER = -100;
const POSSIBLE_FACTORS = [2, 3, 4, 5, 6, 8, 9, 10, 11];

interface EnemyAttributes {
  attack?: number;
  health?: number;
  color?: number;
  speed?: number;
  width?: number;
  height?: number;
}

class Enemy {
  attack?: number;
  health?: number;
  requestedValue?: number;
  displayedText: string;
  color?: number;
  speed?: number;
  width?: number;
  height?: number;
  xPosition: number;
  sPosition: number;
  id: string;
  constructor(
    requestedValue: number,
    displayedText: string,
    xPosition: number,
    sPosition: number,
    speed: number,
    id: string
  ) {
    this.requestedValue = requestedValue;
    this.displayedText = displayedText;
    this.xPosition = xPosition;
    this.sPosition = sPosition;
    this.speed = speed;
    this.id = id;
  }

  move(distance?: number) {
    this.sPosition -= distance || 0.01;
  }

  check(input: number) {
    return this.requestedValue === input;
  }

  calculateScore(coefficient: number, combo: number, level: number): number {
    const base = 100;
    const comboBonus = 0.1;
    const levelBonus = Math.max(1, 1 + 0.1 * (level - 1));
    const sPositionThreshold = 0.5;
    const sPositionBonus = 50;
    const sPositionScore = Math.max(
      0,
      (this.sPosition - sPositionThreshold) * sPositionBonus
    );
    const comboScore = Math.max(1, combo * comboBonus + 1);
    return Math.round(
      (base + sPositionScore * comboScore) * levelBonus * coefficient
    );
  }

  calculateSent(coefficient: number, combo: number) {
    // every 3 combo starting at 0 (2, 5, 8, ...): +1
    // every 0.1 sPosition from 0.6 (0.6, 0.7, 0.8, ...): +1
    let comboSent = Math.max(0, Math.floor((combo + 1) / 3));
    let sPositionSent = Math.max(0, Math.floor((this.sPosition - 0.5) / 0.1));
    return (comboSent + sPositionSent) * coefficient;
  }

  // TODO: Might need to find a different method for conciseness.
  kill(gameData: GameData, giveScore: boolean, giveCombo: boolean) {
    if (giveScore) {
      if (gameData instanceof MultiplayerGameData) {
        let attack = this.calculateSent(1, gameData.combo);
        gameData.totalEnemiesSent += attack;
        gameData.attackScore += attack;
        // gameData.enemiesSentStock += attack;
        while (attack > 0) {
          if (gameData.receivedEnemiesStock > 0) {
            gameData.receivedEnemiesStock -= 1;
          } else {
            // no received enemies in stock
            gameData.enemiesSentStock += 1;
          }
          attack -= 1;
        }
      }
      gameData.score += this.calculateScore(
        1,
        gameData.combo,
        gameData.level || 1
      );
    }
    if (giveCombo) {
      gameData.combo += 1;
      gameData.clocks.comboReset.currentTime = 0;
    }
    gameData.addAction(constructEnemyKillRecord(this));
    removeEnemyWithIDInGameData(this.id, gameData);
  }

  remove(gameData: GameData, damage?: number) {
    if (typeof damage === "number") {
      gameData.baseHealth -= damage;
    }
    removeEnemyWithIDInGameData(this.id, gameData);
  }

  attackBase(gameData: GameData, damage?: number) {
    if (typeof damage === "number") {
      gameData.baseHealth -= damage;
    }
    removeEnemyWithIDInGameData(this.id, gameData);
  }
}

function removeEnemyWithIDInGameData(id: string, gameData: GameData) {
  let index = gameData.enemies.findIndex((element) => element.id === id);
  if (index > -1) {
    gameData.enemies.splice(index, 1);
  }
  gameData.enemiesToErase.push(id);
}

function createNewEnemy(id: string, attributes?: EnemyAttributes) {
  // TODO: Change this algorithm (line below)
  let generatedValue: number = Math.round(Math.random() * 200 - 100);
  // if testing mode is used, then ignore generated value and use set value
  if (USE_TESTING_VALUES) {
    generatedValue = TESTING_VALUES.forcedEnemyValue;
  }
  let enemy: Enemy = new Enemy(
    generatedValue,
    createProblem(generatedValue),
    Math.random(),
    1,
    attributes?.speed || 0.1,
    id
  );
  return enemy;
}

function createNewReceivedEnemy(id: string, attributes?: EnemyAttributes) {
  return createNewEnemy(id, attributes);
}

function createProblem(result: number) {
  let operation = _.sample([
    "none",
    "none",
    "none",
    "addition",
    "subtraction",
    "multiplication",
    "division"
  ]) as string;
  switch (operation) {
    case "none": {
      return `${result}`;
    }
    case "addition": {
      let n1 = Math.floor(Math.random() * result);
      let n2 = result - n1;
      return `${n1} + ${n2}`;
    }
    case "subtraction": {
      let n1 = Math.floor(Math.random() * result);
      let n2 = result + n1;
      return `${n2} - ${n1}`;
    }
    case "multiplication": {
      let n1 = _.sample(getFactorsOf(result));
      let n2 = result / (n1 as number);
      if (result === 0) {
        // TODO: Make it so that either n1, n2, or both is set to 0
        n1 = result;
        n2 = _.sample(POSSIBLE_FACTORS) as number;
      }
      return `${n1} * ${n2}`;
    }
    case "division": {
      // either 1 or -1 will be included
      let coefficient = _.sample(
        _.filter(getFactorsOf(result), (element) => Math.abs(element) <= 12)
      ) as number;
      let n1 = result * coefficient;
      let n2 = coefficient;
      if (result === 0) {
        n1 = result;
        n2 = _.sample(POSSIBLE_FACTORS) as number;
      }
      return `${n1} / ${n2}`;
    }
  }
  log.warn("Operation is not one of the four basic ones.");
  return "";
}

function getFactorsOf(number: number): Array<number> {
  let factors: Array<number> = [];
  let end: number = 1;
  // TODO: it is currently speed mode for positive numbers, and slow mode for negative numbers, fix it.
  if (number < 0) {
    end = -1;
  } else {
    end = Math.floor(Math.sqrt(number));
  }
  for (let i = MINIMUM_GENERABLE_NUMBER; i <= end; i++) {
    if (number % i === 0) {
      factors.push(i);
      if (i !== end) {
        factors.push(Math.round(number / i));
      }
    }
  }
  return factors;
}

function constructEnemyKillRecord(enemy: Enemy) {
  const record: ActionRecord = {
    action: "enemyKill",
    timestamp: Date.now(),
    data: {
      sPositionOnKill: enemy.sPosition
    }
  };
  return record;
}

export { createNewEnemy, createNewReceivedEnemy, Enemy, EnemyAttributes };
