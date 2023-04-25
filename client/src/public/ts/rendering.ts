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
  // base health
  stageItems.textSprites.baseHealthText.text = `♥️ ${variables.clientSideRendering.baseHealth}`;
  // enemies killed (per second)
  stageItems.textSprites.enemiesText.text = `Enemy Kills: ${
    variables.currentGameClientSide.enemiesKilled
  } ≈ ${(
    (variables.currentGameClientSide.enemiesKilled /
      variables.clientSideRendering.totalElapsedMilliseconds) *
    1000
  ).toFixed(3)}/s`;
}

function resetClientSideRendering() {
  variables.clientSideRendering.totalElapsedMilliseconds = 0;
  variables.clientSideRendering.baseHealth = 100;
  variables.currentGameClientSide.enemiesKilled = 0;
}

export { render, resetClientSideRendering };
