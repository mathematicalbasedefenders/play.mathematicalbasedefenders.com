import * as PIXI from "pixi.js";
import _ from "lodash";
import { app, mathFont } from ".";
const ENEMY_SIZE = 64;
const ENEMY_FONT_SIZE = 24;
// file handles all enemy-related stuff
let enemiesCurrentlyDrawn: Array<string> = [];
let enemyCache: Array<Enemy> = [];
const ENEMY_TEXT_STYLE = new PIXI.TextStyle({
  fontSize: ENEMY_FONT_SIZE,
  fontFamily: "Computer Modern Unicode Serif"
});
class Enemy {
  sprite!: PIXI.Sprite;
  displayedText!: PIXI.Text;
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
    this.sprite.tint = Math.floor(Math.random() * 16777215);
    this.sprite.x = 100 + 580 + Math.random() * (600 - 80);
    this.sprite.y = 720 - 720 * sPosition + 80;
    this.sprite.width = width;
    this.sprite.height = height;
    // text-related
    this.displayedText = new PIXI.Text(text, _.clone(ENEMY_TEXT_STYLE));
    this.displayedText.style.fill =
      calculateLuminance(this.sprite.tint) > 0.5 ? 0 : 16777215;
    this.displayedText.x =
      this.sprite.x + (this.sprite.width - this.displayedText.width) / 2;
    this.displayedText.y =
      this.sprite.y + (this.sprite.height - this.displayedText.height) / 2;
    // metadata
    this.id = id;
    // functions
    enemiesCurrentlyDrawn.push(id);
    enemyCache.push(this);
  }
  render() {
    app.stage.addChild(this.sprite);
    app.stage.addChild(this.displayedText);
  }
  reposition(sPosition: number) {
    this.sprite.y = 720 - 720 * sPosition + 80;
    this.displayedText.x =
      this.sprite.x + (this.sprite.width - this.displayedText.width) / 2;
    this.displayedText.y =
      this.sprite.y + (this.sprite.height - this.displayedText.height) / 2;
    if (sPosition <= 0) {
      deleteEnemy(this.id);
    }
  }
}
function getEnemyFromCache(id: string) {
  return enemyCache.find((enemy) => enemy.id === id);
}

function renderNewEnemy(id: string, text: string) {
  let enemy = new Enemy(1, text, id, ENEMY_SIZE, ENEMY_SIZE);
  enemyCache.push(enemy);
  getEnemyFromCache(id)?.render();
}
function repositionExistingEnemy(id: string, sPosition: number) {
  getEnemyFromCache(id)?.reposition(sPosition);
}
function deleteEnemy(id: string) {
  let enemy: Enemy | undefined = getEnemyFromCache(id);
  let sprite: PIXI.Sprite | undefined = getEnemyFromCache(id)?.sprite;
  let text: PIXI.Text | undefined = getEnemyFromCache(id)?.displayedText;
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
function deleteAllEnemies() {
  for (let enemy of enemyCache) {
    deleteEnemy(enemy.id);
  }
}
function rerenderEnemy(id: string, sPosition: number, displayedText?: string) {
  if (enemiesCurrentlyDrawn.indexOf(id) > -1) {
    // enemy already drawn
    repositionExistingEnemy(id, sPosition);
  } else {
    // enemy wasn't drawn yet
    if (typeof displayedText === "string") {
      renderNewEnemy(id, displayedText);
    }
  }
}
function calculateLuminance(colorNumber: number) {
  let r = (colorNumber >> 16) & 255;
  let g = (colorNumber >> 8) & 255;
  let b = colorNumber & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
export {
  Enemy,
  rerenderEnemy,
  enemiesCurrentlyDrawn,
  enemyCache,
  deleteEnemy,
  deleteAllEnemies
};
