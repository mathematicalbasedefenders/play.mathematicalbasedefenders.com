import {
  stage,
  stageItems,
  app,
  ExtendedSprite,
  ExtendedText,
  socket
} from "./index";
import { POLICY, Size, getScaledRect } from "adaptive-scale/lib-esm";
import { Sprite, Texture } from "pixi.js";

// TODO: Might change later
const OPTIMAL_SCREEN_WIDTH: number = window.screen.width;
const OPTIMAL_SCREEN_HEIGHT: number = window.screen.height;
const OPTIMAL_SCREEN_RATIO: number =
  OPTIMAL_SCREEN_WIDTH / OPTIMAL_SCREEN_HEIGHT;

// TODO: Change `any` to something else.
function renderGameData(data: { [key: string]: any }) {
  // clear screen first

  for (let enemy of data.enemies) {
    if (enemiesDrawn.indexOf(enemy.id) > -1) {
      // enemy already drawn
      repositionExistingEnemy(enemy.id, enemy.sPosition);
    } else {
      // enemy wasn't drawn yet
      renderNewEnemy(enemy.id);
    }
  }
}

function redrawStage() {
  let scaleOptions = {
    container: new Size(window.innerWidth, window.innerHeight),
    target: new Size(app.stage.width, app.stage.height),
    policy: POLICY.ShowAll
  };
  let newPosition = getScaledRect(scaleOptions);

  app.stage.x = newPosition.x;
  app.stage.y = newPosition.y;
  app.stage.width = newPosition.width;
  app.stage.height = newPosition.height;
}

function repositionStageItems() {
  for (let item in stageItems) {
  }
}

window.onresize = () => {
  redrawStage();
};

// TODO: Move this to a different file
let enemiesDrawn: Array<string> = [];
let enemyCache: Array<Enemy> = [];
class Enemy {
  sprite!: Sprite;
  text!: Text;
  sPosition!: number;
  xPosition!: number;
  yPosition!: number;
  id!: string;
  constructor(sPosition: number, text: string, id: string) {
    this.sprite = new Sprite(Texture.WHITE);
    this.sprite.tint = 0xff0000;
    this.sprite.x = Math.random() * 640;
    this.sprite.y = 800 - 800 * sPosition;

    this.id = id;
    enemiesDrawn.push(id);
    enemyCache.push(this);
  }
  render() {
    app.stage.addChild(this.sprite);
  }
  reposition(sPosition: number) {
    this.sprite.y = 800 - 800 * sPosition;
    if (sPosition <= 0) {
      deleteEnemy(this.id);
    }
  }
}
function getEnemyFromCache(id: string) {
  return enemyCache.find((enemy) => enemy.id === id);
}

function renderNewEnemy(id: string) {
  let enemy = new Enemy(1, "666", id);
  enemyCache.push(enemy);
  getEnemyFromCache(id)?.render();
}
function repositionExistingEnemy(id: string, sPosition: number) {
  getEnemyFromCache(id)?.reposition(sPosition);
}
function deleteEnemy(id: string) {
  let enemy: Enemy | undefined = getEnemyFromCache(id);
  let sprite: Sprite | undefined = getEnemyFromCache(id)?.sprite;
  if (sprite) {
    app.stage.removeChild(sprite);
  }
  if (enemy) {
    enemyCache.splice(enemyCache.indexOf(enemy), 1);
  }
}

export { renderGameData };
