import _ from "lodash";
import { log } from "./log";

enum EnemyType {
  NORMAL = "1",
  TANK = "2t",
  FIGHTER = "2f",
  SPEEDSTER = "2s"
}

const MINIMUM_GENERABLE_NUMBER = -100;
const MAXIMUM_GENERABLE_NUMBER = 100;

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
  id?: string;
  constructor(
    requestedValue: number,
    displayedText: string,
    xPosition: number,
    sPosition: number,
    id: string
  ) {
    this.requestedValue = requestedValue;
    this.displayedText = displayedText;
    this.xPosition = xPosition;
    this.sPosition = sPosition;
    this.id = id;
    // e.g.
    this.width = 100;
    this.height = 100;
  }

  move(distance?: number) {
    this.sPosition -= distance || 0.01;
  }
}

function createNew(enemyType: EnemyType, id: string) {
  // TODO: Change this algorithm (line below)
  let generatedValue: number = Math.round(Math.random() * 200 - 100);
  let enemy: Enemy = new Enemy(
    generatedValue,
    createProblem(generatedValue),
    200,
    1,
    id
  );
  switch (enemyType) {
    case EnemyType.NORMAL: {
      enemy.attack = 1;
      enemy.health = 1;
      // e.g.
      enemy.color = 0xffffff;
      enemy.speed = 0.01;
      break;
    }
  }
  return enemy;
}

// TODO: this
function createCustom() {}

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
        n2 = _.sample([2, 3, 4, 5, 6, 8, 9, 10, 11]) as number;
      }
      return `${n1} * ${n2}`;
    }
    case "division": {
      // either 1 or -1 will be included
      let coefficient = _.sample(
        _.filter(getFactorsOf(result), (element) => Math.abs(element) <= 12)
      ) as number;
      let n1 = result * coefficient;
      let n2 = result / coefficient;
      if (result === 0) {
        n1 = result;
        n2 = _.sample([2, 3, 4, 5, 6, 8, 9, 10, 11]) as number;
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

export { createNew, Enemy, EnemyType };
