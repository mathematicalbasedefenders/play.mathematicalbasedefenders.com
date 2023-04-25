import { stageItems, variables } from ".";
import { Enemy, getEnemyFromCache } from "./enemies";
import { millisecondsToTime } from "./utilities";

function render(elapsedMilliseconds: number) {
  variables.clientSideRendering.totalElapsedMilliseconds += elapsedMilliseconds;
  // enemies
  let enemiesCurrentlyDrawn = Enemy.enemiesCurrentlyDrawn;
  for (let enemyID of enemiesCurrentlyDrawn) {
    let enemy = getEnemyFromCache(enemyID);
    if (typeof enemy !== "undefined") {
      let age = Date.now() - enemy.creationTime;
      enemy.reposition(1 - enemy.speed * (age / 1000));
    }
  }
  // time elapsed
  stageItems.textSprites.elapsedTimeText.text = millisecondsToTime(
    variables.clientSideRendering.totalElapsedMilliseconds
  );
}

function resetClientSideRendering() {
  variables.clientSideRendering.totalElapsedMilliseconds = 0;
}

export { render, resetClientSideRendering };
