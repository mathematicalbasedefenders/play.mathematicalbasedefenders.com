import { stageItems, variables } from ".";
import { Enemy, getEnemyFromCache } from "./enemies";
import { SlidingText } from "./sliding-text";
import { millisecondsToTime } from "./utilities";

function render(elapsedMilliseconds: number) {
  variables.currentGameClientSide.totalElapsedMilliseconds +=
    elapsedMilliseconds;
  variables.currentGameClientSide.timeSinceLastEnemyKill += elapsedMilliseconds;
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
    variables.currentGameClientSide.totalElapsedMilliseconds
  );
  // base health
  stageItems.textSprites.baseHealthText.text = `♥️ ${variables.currentGameClientSide.baseHealth}`;
  // enemies killed (per second)
  stageItems.textSprites.enemiesText.text = `Enemy Kills: ${
    variables.currentGameClientSide.enemiesKilled
  } ≈ ${(
    (variables.currentGameClientSide.enemiesKilled /
      variables.currentGameClientSide.totalElapsedMilliseconds) *
    1000
  ).toFixed(3)}/s`;
  // combo text fading
  stageItems.textSprites.comboText.alpha = Math.max(
    0,
    1 -
      variables.currentGameClientSide.timeSinceLastEnemyKill /
        variables.currentGameClientSide.comboTime
  );
  // sliding text
  const slidingTexts = SlidingText.slidingTexts.filter(
    (element) => element.rendering
  );
  for (const slidingText of slidingTexts) {
    slidingText.timeSinceFirstRender += elapsedMilliseconds;
    const point = slidingText.slideBezier.calculatePoint(
      slidingText.duration,
      slidingText.timeSinceFirstRender
    );
    const opacity = slidingText.fadeBezier.calculatePoint(
      slidingText.duration,
      slidingText.timeSinceFirstRender
    ).y;
    slidingText.textSprite.x = point.x;
    slidingText.textSprite.y = point.y;
    slidingText.textSprite.alpha = opacity;
    if (slidingText.duration < slidingText.timeSinceFirstRender) {
      slidingText.delete();
    }
  }
}

function resetClientSideRendering() {
  variables.currentGameClientSide.totalElapsedMilliseconds = 0;
  variables.currentGameClientSide.baseHealth = 100;
  variables.currentGameClientSide.enemiesKilled = 0;
}

// TODO: Change this to a loop w/ allowed values
function setClientSideRendering(data: { [key: string]: any }) {
  if (data.baseHealth) {
    variables.currentGameClientSide.baseHealth = parseFloat(data.baseHealth);
  }
}

export { render, resetClientSideRendering, setClientSideRendering };
