import * as PIXI from "pixi.js";
import { app, mathFont } from ".";
const ENEMY_SIZE = 64;
const ENEMY_FONT_SIZE = 24;
// file handles all enemy-related stuff
let enemiesCurrentlyDrawn: Array<string> = [];
let enemyCache: Array<Enemy> = [];
const ENEMY_TEXT_STYLE = new PIXI.TextStyle({
  fontSize: ENEMY_FONT_SIZE,
  fontFamily: "Computer Modern Math Italic",
  fill: "0xffffff"
});
class Enemy {
  sprite!: PIXI.Sprite;
  textShown!: PIXI.Text;
  sPosition!: number;
  xPosition!: number;
  yPosition!: number;
  id!: string;
  constructor(
    sPosition: number,
    text: string,
    id: string,
    width: number,
    height: number
  ) {
    this.sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.sprite.tint = 0xff0000;
    this.sprite.x = Math.random() * 640;
    this.sprite.y = 800 - 800 * sPosition;
    this.sprite.width = width;
    this.sprite.height = height;
    // text-related
    this.textShown = new PIXI.Text(text, ENEMY_TEXT_STYLE);
    this.textShown.x =
      this.sprite.x + (this.sprite.width - this.textShown.width) / 2;
    this.textShown.y =
      this.sprite.y + (this.sprite.height - this.textShown.height) / 2;
    // metadata
    this.id = id;
    // functions
    enemiesCurrentlyDrawn.push(id);
    enemyCache.push(this);
  }
  render() {
    app.stage.addChild(this.sprite);
    app.stage.addChild(this.textShown);
  }
  reposition(sPosition: number) {
    this.sprite.y = 800 - 800 * sPosition;
    this.textShown.x =
      this.sprite.x + (this.sprite.width - this.textShown.width) / 2;
    this.textShown.y =
      this.sprite.y + (this.sprite.height - this.textShown.height) / 2;
    if (sPosition <= 0) {
      deleteEnemy(this.id);
    }
  }
}
function getEnemyFromCache(id: string) {
  return enemyCache.find((enemy) => enemy.id === id);
}

function renderNewEnemy(id: string) {
  let enemy = new Enemy(1, "666", id, ENEMY_SIZE, ENEMY_SIZE);
  enemyCache.push(enemy);
  getEnemyFromCache(id)?.render();
}
function repositionExistingEnemy(id: string, sPosition: number) {
  getEnemyFromCache(id)?.reposition(sPosition);
}
function deleteEnemy(id: string) {
  let enemy: Enemy | undefined = getEnemyFromCache(id);
  let sprite: PIXI.Sprite | undefined = getEnemyFromCache(id)?.sprite;
  let text: PIXI.Text | undefined = getEnemyFromCache(id)?.textShown;
  if (sprite) {
    app.stage.removeChild(sprite);
  }
  if (text) {
    app.stage.removeChild(text);
  }
  if (enemy) {
    enemyCache.splice(enemyCache.indexOf(enemy), 1);
  }
}
function rerenderEnemy(id: string, sPosition: number) {
  if (enemiesCurrentlyDrawn.indexOf(id) > -1) {
    // enemy already drawn
    repositionExistingEnemy(id, sPosition);
  } else {
    // enemy wasn't drawn yet
    renderNewEnemy(id);
  }
}

export {
  Enemy,
  rerenderEnemy,
  enemiesCurrentlyDrawn as enemiesDrawn,
  enemyCache
};
