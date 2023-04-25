import { Enemy, getEnemyFromCache } from "./enemies";

function render(deltaTime: number) {
  // enemies
  let enemiesCurrentlyDrawn = Enemy.enemiesCurrentlyDrawn;
  for (let enemyID of enemiesCurrentlyDrawn) {
    let enemy = getEnemyFromCache(enemyID);
    if (typeof enemy !== "undefined") {
      let age = Date.now() - enemy.creationTime;
      enemy.reposition(1 - enemy.speed * (age / 1000));
    }
  }
}
export { render };
