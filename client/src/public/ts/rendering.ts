import { stageItems, variables } from ".";
import { renderBeautifulScoreDisplay } from "./beautiful-score-display";
import { Enemy, getEnemyFromCache } from "./enemies";
import { renderGameData } from "./game";
import { replayGameData, updateReplayGameDataLikeServer } from "./replay";
import { SlidingText } from "./sliding-text";
import { formatNumber, millisecondsToTime } from "./utilities";

/**
 * Renders the game data according to cached data from client-side.
 * This should be overwritten by server data.
 */
function render(elapsedMilliseconds: number) {
  const timestampOfFunctionCall = Date.now();

  /**
   * Update replay data as well
   */
  if (variables.watchingReplay) {
    renderEnemies();
    updateReplayGameDataLikeServer(elapsedMilliseconds);
    renderGameData(replayGameData);
    showReplayIndicatorText();
  } else {
    hideReplayIndicatorText();
  }

  /**
   * Updates the shown client-side `Enemy`s.
   */
  function renderEnemies() {
    // enemies
    let enemiesDrawn = Enemy.enemiesDrawn;
    for (let enemyID of enemiesDrawn) {
      let enemy = getEnemyFromCache(enemyID);
      if (typeof enemy !== "undefined") {
        let age = Date.now() - enemy.creationTime;
        const speed = variables.currentGameClientSide.enemySpeedCoefficient;
        enemy.reposition(1 - enemy.speed * speed * (age / 1000));
      }
    }
  }

  /**
   * Updates the shown client-side statistics.
   */
  function renderStatistics() {
    variables.currentGameClientSide.totalElapsedMilliseconds +=
      elapsedMilliseconds;
    variables.currentGameClientSide.timeSinceLastEnemyKill +=
      elapsedMilliseconds;
    // variables
    const msElapsed = variables.currentGameClientSide.totalElapsedMilliseconds;
    const health = variables.currentGameClientSide.baseHealth;
    const enemyKills = variables.currentGameClientSide.enemiesKilled;
    const enemyKillRate =
      (variables.currentGameClientSide.enemiesKilled /
        variables.currentGameClientSide.totalElapsedMilliseconds) *
      1000;
    const comboTextAlpha = Math.max(
      0,
      1 -
        variables.currentGameClientSide.timeSinceLastEnemyKill /
          variables.currentGameClientSide.comboTime
    );
    // time elapsed
    stageItems.textSprites.elapsedTimeText.text = millisecondsToTime(msElapsed);
    // base health
    stageItems.textSprites.baseHealthText.text = `♥︎ ${formatNumber(health)}`;
    // enemies killed
    stageItems.textSprites.enemiesText.text = `Enemy Kills: ${enemyKills.toLocaleString(
      "en-US"
    )}`;
    // enemies killed per second
    stageItems.textSprites.enemiesText.text += ` ≈ ${formatNumber(
      enemyKillRate
    )}/s`;
    // combo text fading
    stageItems.textSprites.comboText.alpha = comboTextAlpha;
    // input
    if (
      variables.currentGameClientSide.timestampOfSynchronization >
        timestampOfFunctionCall ||
      variables.watchingReplay
    ) {
      stageItems.textSprites.inputText.text =
        variables.currentGameClientSide.synchronizedInput.replaceAll("-", "−");
    } else {
      stageItems.textSprites.inputText.text =
        variables.currentGameClientSide.currentInput.replaceAll("-", "−");
    }
  }

  /**
   * Updates the rendering of the `SlidingText`s.
   */
  function renderSlidingTexts() {
    const activeSlidingTexts = Object.keys(SlidingText.slidingTexts).filter(
      (element) => SlidingText.slidingTexts[element].rendering
    );
    for (const id of activeSlidingTexts) {
      const slidingText = SlidingText.slidingTexts[id];
      slidingText.timeSinceFirstRender += elapsedMilliseconds;
      const point = slidingText.slideBezier.calculatePoint(
        slidingText.timeSinceFirstRender
      );
      const opacity = slidingText.fadeBezier.calculatePoint(
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

  renderEnemies();
  renderSlidingTexts();
  renderStatistics();

  // beautiful score display
  if (variables.settings.beautifulScore === "on") {
    variables.currentGameClientSide.beautifulScoreDisplayProgress +=
      elapsedMilliseconds;
    renderBeautifulScoreDisplay();
  } else {
    const score = variables.currentGameClientSide.shownScore;
    stageItems.textSprites.scoreText.text =
      parseInt(score).toLocaleString("en-US") || "0";
  }

  const inputFlashAlpha = getInputFlashAlpha();
  stageItems.sprites.inputFlash.alpha = inputFlashAlpha;
}

/**
 * Resets the `variables`' client-side data.
 */
function resetClientSideVariables() {
  variables.currentGameClientSide.totalElapsedMilliseconds = 0;
  variables.currentGameClientSide.baseHealth = 100;
  variables.currentGameClientSide.enemiesKilled = 0;
  variables.currentGameClientSide.enemySpeedCoefficient = 1;
  variables.currentGameClientSide.shownScore = 0;
  variables.currentGameClientSide.beautifulScoreDisplayGoal = 0;
  variables.currentGameClientSide.beautifulScoreDisplayProgress = 0;
  variables.currentGameClientSide.beautifulScoreDisplayPrevious = 0;
  variables.currentGameClientSide.currentInput = "";
  variables.currentGameClientSide.synchronizedInput = "";
  variables.currentGameClientSide.inputFlashStart = 0;
}

/**
 * Sets client side rendering.
 * TODO: Change this to a loop w/ allowed values
 */
function setClientSideRendering(data: { [key: string]: any }) {
  if (data.baseHealth) {
    variables.currentGameClientSide.baseHealth = parseFloat(data.baseHealth);
  }
}

function showReplayIndicatorText() {
  stageItems.textSprites.replayIndicatorText.visible = true;
}

function hideReplayIndicatorText() {
  stageItems.textSprites.replayIndicatorText.visible = false;
}

function flashInputArea() {
  variables.currentGameClientSide.inputFlashStart = Date.now();
}

function getInputFlashAlpha() {
  const FLOOR = 0;
  const DURATION = 500;
  const timeFromStart =
    Date.now() - variables.currentGameClientSide.inputFlashStart;
  if (timeFromStart > DURATION) {
    return 0;
  }
  const value = Math.sin((timeFromStart / DURATION) * Math.PI);
  return Math.max(FLOOR, value);
}

export {
  render,
  resetClientSideVariables,
  setClientSideRendering,
  flashInputArea
};
