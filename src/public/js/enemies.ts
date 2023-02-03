import { Sprite, Texture } from "pixi.js";
import { app } from ".";

// file handles all enemy-related stuff
let enemiesCurrentlyDrawn: Array<string> = [];
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
    enemiesCurrentlyDrawn.push(id);
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
