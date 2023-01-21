enum EnemyType {
  NORMAL = "1",
  TANK = "2t",
  FIGHTER = "2f",
  SPEEDSTER = "2s"
}

class Enemy {
  attack?: number;
  health?: number;
  requestedValue: number;
  displayedText: string;
  color?: number;
  speed?: number;
  width?: number;
  height?: number;
  xPosition: number;
  sPosition: number;

  constructor(
    requestedValue: number,
    displayedText: string,
    xPosition: number,
    sPosition: number
  ) {
    this.requestedValue = requestedValue;
    this.displayedText = displayedText;
    this.xPosition = xPosition;
    this.sPosition = sPosition;

    // e.g.
    this.width = 100;
    this.height = 100;
  }
}

function createNew(enemyType: EnemyType) {
  // TODO: Change this algorithm (line below)
  let generatedValue: number = Math.round(Math.random() * 200 - 100);
  let enemy: Enemy = new Enemy(
    generatedValue,
    generatedValue.toString(),
    200,
    1
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

export { createNew, Enemy };
