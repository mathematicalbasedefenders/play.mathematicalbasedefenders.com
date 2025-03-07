// This file handles most/all enemy-related stuff.

import * as PIXI from "pixi.js";
import _ from "lodash";
import { app, mathFont, playerContainer, variables } from "./index";
import { playSound } from "./sounds";
const ENEMY_FONT_SIZE = 24;
const DEFAULT_ENEMY_WIDTH = 64;
const DEFAULT_ENEMY_HEIGHT = 64;
const MAXIMUM_Y_POSITION = 880;
const PLAYFIELD_WIDTH = 600;

const ENEMY_COLOR_PALETTES: { [key: string]: Array<number> } = {
  // https://www.color-hex.com/color-palette/18840
  "fire": [0xff0000, 0xff5a00, 0xff9a00, 0xffce00, 0xffe808],
  // https://www.color-hex.com/color-palette/6839
  "aurora": [0x14e81e, 0x00ea8d, 0x017ed5, 0xb53dff, 0x8d00c4],
  // https://www.color-hex.com/color-palette/184
  "grayscale": [0x999999, 0x777777, 0x555555, 0x333333, 0x111111]
};

const ENEMY_TEXT_STYLE = new PIXI.TextStyle({
  fontSize: ENEMY_FONT_SIZE,
  fontFamily: "Computer Modern Unicode Serif"
});

/**
 * This is to be used when enemy data is sent from the server-side.
 * For basically everything else, use the regular client-side `Enemy`.
 */
type ServerSideEnemy = {
  id: string;
  displayedText: string;
  speed: number;
  xPosition: number;
  sPosition: number;
};

/**
 * This class is for a client-side enemy.
 * For parsing data from server-side, use `ServerSideEnemy`.
 */
class Enemy {
  static enemiesDrawn: Array<string> = [];
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
    // meta-related
    const maxXPosition = 600 + PLAYFIELD_WIDTH - getScaledEnemyWidth();
    // sprite-related
    this.sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.sprite.tint = getSetEnemyColor();
    this.sprite.width = width || getScaledEnemyWidth();

    this.sprite.height = height || getScaledEnemyHeight();
    // playfield width is 600px
    // therefore, the highest x coordinate an enemy can spawn in would be 640+600-width
    // therefore if xPosition = 0.1, spawn at 640+(600-width)*0.1
    this.sprite.x = 640 + (xPosition || Math.random()) * (maxXPosition - 600);
    const traveled = MAXIMUM_Y_POSITION * (1 - sPosition);
    this.sprite.y = traveled - getScaledEnemyHeight();

    this.text = text;
    // text-related
    this.textSprite = new PIXI.Text(
      beautifyMathText(text, variables.settings.multiplicationSign === "times"),
      _.clone(ENEMY_TEXT_STYLE)
    );
    this.textSprite.style.fill =
      getLuminance(this.sprite.tint) > 0.5 ? 0x000000 : 0xffffff;
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
    Enemy.enemiesDrawn.push(id);
    Enemy.enemyCache.push(this);
  }

  /**
   * Renders the enemy.
   */
  render() {
    playerContainer.addChild(this.sprite);
    playerContainer.addChild(this.textSprite);
  }

  /**
   * This moves the enemy to the specified `sPosition`.
   * TODO: Enemy will damage the base and get deleted if new sPosition <= 0
   * @param {number} sPosition The sPosition to render the enemy at.
   */
  reposition(sPosition: number) {
    const traveled = MAXIMUM_Y_POSITION * (1 - sPosition);
    this.sprite.y = traveled - getScaledEnemyHeight();
    this.textSprite.x =
      this.sprite.x + (this.sprite.width - this.textSprite.width) / 2;
    this.textSprite.y =
      this.sprite.y + (this.sprite.height - this.textSprite.height) / 2;
    this.textSprite.style.fontSize = getBestFontSize(
      2,
      this.textSprite.text,
      this.sprite.width
    );
    this.sPosition = sPosition;
    if (sPosition <= 0) {
      deleteEnemy(this.id);
      if (!this.attackedBase) {
        playSound("assets/sounds/damaged.mp3", true);
        variables.currentGameClientSide.baseHealth -= 10;
        this.attackedBase = true;
      }
    }
  }

  /**
   * Calculates how many points a killed enemy should earn the player.
   * @param {number} coefficient The multiplier to apply to the score.
   * @param {number} combo The current combo.
   * @returns The score to add.
   */
  calculateScore(coefficient: number, combo: number, level: number) {
    const base = 100;
    const comboBonus = 0.1;
    const sPositionThreshold = 0.5;
    const sPositionBonus = 50;
    const sPositionScore = Math.max(
      0,
      (this.sPosition - sPositionThreshold) * sPositionBonus
    );
    const comboScore = Math.max(1, combo * comboBonus + 1);
    const levelCoefficient = Math.max(1, 1 + 0.1 * (level - 1));
    return Math.round(
      (base + sPositionScore * comboScore) * levelCoefficient * coefficient
    );
  }

  /**
   * Calculates how many enemies should be sent (to opponents) on a killed enemy.
   * Every 3 combo starting at 0 (2, 5, 8, ...): +1
   * Every 0.1 sPosition from 0.6 (0.6, 0.7, 0.8, ...): +1
   * @param {number} coefficient The multiplier to apply to the score.
   * @param {number} combo The current combo.
   * @returns The score to add.
   */
  calculateSent(coefficient: number, combo: number) {
    const comboInterval = 3;
    const sPositionInterval = 0.1;
    const sPositionThreshold = 0.5;
    const positionDifference = this.sPosition - sPositionThreshold;

    const comboSent = Math.max(0, Math.floor((combo + 1) / comboInterval));
    const sPositionSent = Math.max(
      0,
      Math.floor(positionDifference / sPositionInterval)
    );
    return (comboSent + sPositionSent) * coefficient;
  }

  /**
   * Creates the text that should be shown for each enemy according to game mode.
   * One of the reasons the function is here so that I don't have to duplicate code on whether a +100 should be shown or a sent 1 should be shown.
   * @returns The text.
   */
  getText() {
    if (variables.currentGameMode === "multiplayer") {
      return this.calculateSent(
        1,
        variables.currentGameClientSide.currentCombo
      ).toLocaleString("en-US");
    }
    return this.calculateScore(
      1,
      variables.currentGameClientSide.currentCombo,
      variables.currentGameClientSide.level
    ).toLocaleString("en-US");
  }
}

/**
 * This gets the enemy with ID `id` from `Enemy.enemyCache`.
 * @param {string} id The ID of the enemy to get.
 * @returns The client-side `Enemy` if such enemy exists, `undefined` otherwise.
 */
function getCachedEnemy(id: string) {
  return Enemy.enemyCache.find((enemy) => enemy.id === id);
}

/**
 * This function calculates the best font size.
 * The best font size is the largest font size that can fit the `text` within the 95% of the enemy's width without going over.
 * @param {number} decrement How much to decrement by each step.
 * @param {string} text The text to measure.
 * @param {number} width The width of the enemy.
 * @returns The best font size (approximately the largest that could fit the enemy)
 */
function getBestFontSize(decrement: number, text: string, width: number) {
  let size = ENEMY_FONT_SIZE * variables.settings.enemySizeCoefficient;
  let style = _.clone(ENEMY_TEXT_STYLE);
  while (size > 12) {
    let textMetrics = PIXI.CanvasTextMetrics.measureText(text, style);
    if (textMetrics.width < width * 0.95) {
      return size;
    }
    style.fontSize = parseInt(style.fontSize as unknown as string) - decrement;
    size -= decrement;
  }
  return size;
}

/**
 * This function renders a `ServerSideEnemy`.
 * @param {ServerSideEnemy} enemy A `ServerSideEnemy`.
 */
function renderEnemy(enemy: ServerSideEnemy) {
  const newEnemy = new Enemy(
    1,
    enemy.displayedText,
    enemy.id,
    getScaledEnemyWidth(),
    getScaledEnemyHeight(),
    enemy.speed,
    enemy.xPosition
  );
  Enemy.enemyCache.push(newEnemy);
  getCachedEnemy(newEnemy.id)?.render();
}

/**
 * This function repositions the enemy with ID `id` to sPosition `sPosition`.
 * @param {string} id The ID of the enemy
 * @param {number} sPosition The new position of the enemy
 */
function repositionEnemy(id: string, sPosition: number) {
  getCachedEnemy(id)?.reposition(sPosition);
}

/**
 * Deletes the enemy with the ID `id` from `Enemy.enemyCache`.
 * @param {string} id The ID of the enemy to delete.
 */
function deleteEnemy(id: string) {
  const text = getCachedEnemy(id)?.textSprite;
  const enemy = getCachedEnemy(id);
  const sprite = getCachedEnemy(id)?.sprite;
  if (typeof sprite !== "undefined") {
    playerContainer.removeChild(sprite);
  }
  if (typeof text !== "undefined") {
    playerContainer.removeChild(text);
  }
  if (typeof enemy !== "undefined") {
    const enemyIndex = Enemy.enemyCache.indexOf(enemy);
    Enemy.enemyCache.splice(enemyIndex, 1);
  }
}

/**
 * Deletes all the enemies in `Enemy.enemyCache` that are currently rendered.
 */
function deleteAllEnemies() {
  for (let enemy of Enemy.enemyCache) {
    deleteEnemy(enemy.id);
  }
}

/**
 * This function attempts to rerender a `ServerSideEnemy`.
 * If it doesn't already exist, it will render a new one.
 * @param {ServerSideEnemy} enemyData A `ServerSideEnemy`.
 */
function rerenderEnemy(enemyData: ServerSideEnemy) {
  if (Enemy.enemiesDrawn.indexOf(enemyData.id) > -1) {
    // enemy already drawn
    repositionEnemy(enemyData.id, enemyData.sPosition);
  } else {
    // enemy wasn't drawn yet
    if (typeof enemyData.displayedText === "string") {
      renderEnemy(enemyData);
    }
  }
}

/**
 * Beautifies the math text, making it look nicer and more readable on the screen.
 * @param {text} text The text of the enemy.
 * @param {text} useCross Whether to use the cross for the multiplication sign. This should be from a user setting, not hardcoded.
 * @returns The text filled with unicode characters.
 */
function beautifyMathText(text: string, useCross?: boolean) {
  text = text.replace(/-/g, "\u2212");
  text = text.replace(/\//g, "\u00f7");
  if (useCross) {
    text = text.replace(/\*/g, "\u00d7");
  } else {
    text = text.replace(/\*/g, "\u22c5");
  }
  return text;
}

/**
 * Gets the luminance of a color.
 * @param colorNumber The number of the color (red = 0xff0000, etc...)
 * @returns The luminance of the color.
 */
function getLuminance(colorNumber: number) {
  const rCoefficient = 0.2126;
  const gCoefficient = 0.7152;
  const bCoefficient = 0.0722;
  const steps = 255;

  const r = ((colorNumber >> 16) & steps) * rCoefficient;
  const g = ((colorNumber >> 8) & steps) * gCoefficient;
  const b = (colorNumber & steps) * bCoefficient;
  return (r + g + b) / steps;
}

/**
 * Gets the enemy color.
 * The enemy color is what the enemy color should be.
 * If the setting for the enemy color is random, a new color will be picked randomly for each enemy.
 * @returns The color's number.
 */
function getSetEnemyColor() {
  const hexBase = 16;
  const maximumValue = 16777216;
  const value = variables.settings.enemyColor;
  const validHexRegex = /\#[0-9a-f]{6}/;
  if (variables.settings.enemyColor === "randomFromPalette") {
    // select from palette
    const palette = $("#selected-enemy-color-palette").val()?.toString();
    if (
      typeof palette === "string" &&
      Object.keys(ENEMY_COLOR_PALETTES).indexOf(palette) > -1
    ) {
      const paletteColors = ENEMY_COLOR_PALETTES[palette].length;
      const roll = Math.floor(Math.random() * paletteColors);
      return ENEMY_COLOR_PALETTES[palette][roll];
    }
    // in case palette name is invalid...
    // return random color
    return Math.floor(Math.random() * maximumValue);
  } else if (!validHexRegex.test(value)) {
    // random color
    return Math.floor(Math.random() * maximumValue);
  }
  return parseInt(value.substring(1), hexBase);
}

function getScaledEnemyWidth() {
  return (
    DEFAULT_ENEMY_WIDTH *
    parseFloat(variables.settings.enemySizeCoefficient) *
    parseInt(variables.settings.enemyWidthCoefficient || 1)
  );
}

function getScaledEnemyHeight() {
  return (
    DEFAULT_ENEMY_HEIGHT * parseFloat(variables.settings.enemySizeCoefficient)
  );
}

export {
  Enemy,
  rerenderEnemy,
  deleteEnemy,
  deleteAllEnemies,
  getSetEnemyColor,
  getCachedEnemy as getEnemyFromCache,
  DEFAULT_ENEMY_HEIGHT,
  DEFAULT_ENEMY_WIDTH,
  getScaledEnemyHeight,
  getScaledEnemyWidth,
  ENEMY_TEXT_STYLE
};
