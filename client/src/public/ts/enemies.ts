import * as PIXI from "pixi.js";
import _ from "lodash";
import { app, mathFont, variables } from "./index";
import { getSettings } from "./settings";
const ENEMY_SIZE = 64;
const ENEMY_FONT_SIZE = 24;
const DEFAULT_ENEMY_WIDTH = 125;
const DEFAULT_ENEMY_HEIGHT = 125;
// file handles all enemy-related stuff

const ENEMY_TEXT_STYLE = new PIXI.TextStyle({
  fontSize: ENEMY_FONT_SIZE,
  fontFamily: "Computer Modern Unicode Serif"
});
class Enemy {
  static enemiesCurrentlyDrawn: Array<string> = [];
  static enemyCache: Array<Enemy> = [];
  sprite!: PIXI.Sprite;
  textSprite!: PIXI.Text;
  sPosition!: number;
  xPosition!: number;
  yPosition!: number;
  id!: string;
  text!: string;
  creationTime: number;
  speed: number;
  attackedBase: boolean;
  addedKill: boolean;
  constructor(
    sPosition: number,
    text: string,
    id: string,
    width: number,
    height: number,
    speed: number,
    xPosition?: number
  ) {
    // sprite-related
    this.sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.sprite.tint = getEnemyColor();
    this.sprite.width =
      (width || DEFAULT_ENEMY_WIDTH) *
      parseInt(variables.settings.enemyWidthCoefficient || 1);
    this.sprite.height = height || DEFAULT_ENEMY_HEIGHT;
    this.sprite.x =
      100 + 580 + (xPosition || Math.random()) * (600 - DEFAULT_ENEMY_WIDTH);
    this.sprite.y = 720 - 720 * sPosition + DEFAULT_ENEMY_HEIGHT - 40;
    this.text = text;
    // text-related
    this.textSprite = new PIXI.Text(
      beautifyDisplayedText(
        text,
        variables.settings.multiplicationSign === "times"
      ),
      _.clone(ENEMY_TEXT_STYLE)
    );
    this.textSprite.style.fill =
      calculateLuminance(this.sprite.tint) > 0.5 ? 0 : 16777215;
    this.textSprite.x =
      this.sprite.x + (this.sprite.width - this.textSprite.width) / 2;
    this.textSprite.y =
      this.sprite.y + (this.sprite.height - this.textSprite.height) / 2;
    // internal-related
    this.speed = speed;
    this.sPosition = sPosition;
    this.attackedBase = false;
    this.addedKill = false;
    // metadata
    this.id = id;
    this.creationTime = Date.now();
    // functions
    Enemy.enemiesCurrentlyDrawn.push(id);
    Enemy.enemyCache.push(this);
  }
  render() {
    app.stage.addChild(this.sprite);
    app.stage.addChild(this.textSprite);
  }
  reposition(sPosition: number) {
    this.sprite.y = 720 - 720 * sPosition + DEFAULT_ENEMY_HEIGHT - 40;
    this.textSprite.x =
      this.sprite.x + (this.sprite.width - this.textSprite.width) / 2;
    this.textSprite.y =
      this.sprite.y + (this.sprite.height - this.textSprite.height) / 2;
    this.textSprite.style.fontSize = calculateOptimalFontSize(
      2,
      this.textSprite.text,
      this.sprite.width
    );
    this.sPosition = sPosition;
    if (sPosition <= 0) {
      deleteEnemy(this.id);
      if (!this.attackedBase) {
        variables.currentGameClientSide.baseHealth -= 10;
        this.attackedBase = true;
      }
    }
  }
}
function getEnemyFromCache(id: string) {
  return Enemy.enemyCache.find((enemy) => enemy.id === id);
}
function calculateOptimalFontSize(
  decrement: number,
  text: string,
  width: number
) {
  let size = ENEMY_FONT_SIZE;
  let style = _.clone(ENEMY_TEXT_STYLE);
  while (size > 12) {
    let textMetrics = PIXI.TextMetrics.measureText(text, style);
    if (textMetrics.width < width * 0.95) {
      return size;
    }
    style.fontSize = parseInt(style.fontSize as string) - decrement;
    size -= decrement;
  }
  return size;
}
function renderNewEnemy(
  id: string,
  text: string,
  speed: number,
  xPosition?: number
) {
  let enemy = new Enemy(1, text, id, ENEMY_SIZE, ENEMY_SIZE, speed, xPosition);
  Enemy.enemyCache.push(enemy);
  getEnemyFromCache(id)?.render();
}
function repositionExistingEnemy(id: string, sPosition: number) {
  getEnemyFromCache(id)?.reposition(sPosition);
}
function deleteEnemy(id: string, addClientSideKill?: boolean) {
  let enemy: Enemy | undefined = getEnemyFromCache(id);
  let sprite: PIXI.Sprite | undefined = getEnemyFromCache(id)?.sprite;
  let text: PIXI.Text | undefined = getEnemyFromCache(id)?.textSprite;
  if (sprite) {
    app.stage.removeChild(sprite);
  }
  if (text) {
    app.stage.removeChild(text);
  }
  if (enemy) {
    Enemy.enemyCache.splice(Enemy.enemyCache.indexOf(enemy), 1);
  }
}
function deleteAllEnemies() {
  for (let enemy of Enemy.enemyCache) {
    deleteEnemy(enemy.id);
  }
}
function rerenderEnemy(
  id: string,
  sPosition: number,
  speed: number,
  displayedText?: string,
  xPosition?: number
) {
  if (Enemy.enemiesCurrentlyDrawn.indexOf(id) > -1) {
    // enemy already drawn
    repositionExistingEnemy(id, sPosition);
  } else {
    // enemy wasn't drawn yet
    if (typeof displayedText === "string") {
      renderNewEnemy(id, displayedText, speed, xPosition);
    }
  }
}
function beautifyDisplayedText(
  text: string,
  useTimesForMultiplication?: boolean
) {
  text = text.replace(/-/g, "\u2212");
  text = text.replace(/\//g, "\u00f7");
  if (useTimesForMultiplication) {
    text = text.replace(/\*/g, "\u00d7");
  } else {
    text = text.replace(/\*/g, "\u22c5");
  }
  return text;
}
function calculateLuminance(colorNumber: number) {
  let r = (colorNumber >> 16) & 255;
  let g = (colorNumber >> 8) & 255;
  let b = colorNumber & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function getEnemyColor() {
  let value = variables.settings.enemyColor;
  if (!/\#[0-9a-f]{6}/.test(value)) {
    return Math.floor(Math.random() * 16777216);
  }
  return parseInt(value.substring(1), 16);
}
export {
  Enemy,
  rerenderEnemy,
  deleteEnemy,
  deleteAllEnemies,
  getEnemyColor,
  getEnemyFromCache,
  DEFAULT_ENEMY_HEIGHT,
  DEFAULT_ENEMY_WIDTH,
  ENEMY_TEXT_STYLE
};
