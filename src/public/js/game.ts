import {
  stage,
  stageItems,
  app,
  ExtendedSprite,
  ExtendedText,
  socket
} from "./index";
import * as enemies from "./enemies";
import { POLICY, Size, getScaledRect } from "adaptive-scale/lib-esm";
import { millisecondsToTime } from "./utilities";
import { variables } from "./index";
// TODO: Might change later
const OPTIMAL_SCREEN_WIDTH: number = 1920;
const OPTIMAL_SCREEN_HEIGHT: number = 1080;
const OPTIMAL_SCREEN_RATIO: number =
  OPTIMAL_SCREEN_WIDTH / OPTIMAL_SCREEN_HEIGHT;

// TODO: Change `any` to something else.
function renderGameData(data: { [key: string]: any }) {
  // html updates go here.

  if (data.commands.updateText) {
    for (let command in data.commands.updateText) {
      $(data.commands.updateText[command].selector).text(
        data.commands.updateText[command].newText
      );
    }
  }

  if (typeof data.commands.changeScreenTo === "string") {
    changeScreen(data.commands.changeScreenTo);
    return;
  }

  // erase killed enemies
  for (let enemyID of Object.values(data.enemiesToErase)) {
    enemies.deleteEnemy(enemyID as string);
  }

  for (let enemy of data.enemies) {
    enemies.rerenderEnemy(enemy.id, enemy.sPosition, enemy.displayedText);
  }

  // text
  stageItems.textSprites.inputText.text = data.currentInput;
  stageItems.textSprites.enemiesText.text = `Enemy Kills: ${
    data.enemiesKilled
  } ≈ ${((data.enemiesKilled / data.elapsedTime) * 1000).toFixed(3)}/s`;
  stageItems.textSprites.elapsedTimeText.text = millisecondsToTime(
    data.elapsedTime
  );
  if (data.combo > 0) {
    stageItems.textSprites.comboText.text = `${data.combo} Combo`;
    stageItems.textSprites.comboText.alpha = Math.max(
      0,
      1 -
        data.clocks.comboResetTime.currentTime /
          data.clocks.comboResetTime.actionTime
    );
  } else {
    stageItems.textSprites.comboText.text = ``;
  }

  stageItems.textSprites.baseHealthText.text = `♥️ ${data.baseHealth}`;

  if (variables.beautifulScoreCounter) {
    let currentDisplayedScore = parseInt(stageItems.textSprites.scoreText.text);
    if (data.score !== currentDisplayedScore) {
      if (variables.scoreOnLastUpdate !== data.score) {
        variables.scoreOnLastUpdate = data.score;
      }
      let difference = variables.scoreOnLastUpdate - currentDisplayedScore;
      stageItems.textSprites.scoreText.text =
        currentDisplayedScore + Math.round(difference / 60);
      if (data.score < currentDisplayedScore * 1.1) {
        stageItems.textSprites.scoreText.text = data.score;
      }
    }
  } else {
    stageItems.textSprites.scoreText.text = data.score;
  }
}

function redrawStage() {
  let scaleOptions = {
    container: new Size(window.innerWidth, window.innerHeight),
    target: new Size(app.stage.width, app.stage.height),
    policy: POLICY.ShowAll
  };
  let newPosition = getScaledRect(scaleOptions);
  app.stage.x = newPosition.x;
  app.stage.y = newPosition.y;
  app.stage.width = newPosition.width;
  app.stage.height = newPosition.height;
}

function changeScreen(screen?: string, alsoRedrawStage?: boolean) {
  $("#main-content__main-menu-screen-container").hide(0);
  $("#main-content__singleplayer-menu-screen-container").hide(0);
  $("#main-content__game-over-screen-container").hide(0);
  $("#canvas-container").hide(0);
  // other stuff
  if (alsoRedrawStage) {
    redrawStage();
  }
  enemies.deleteAllEnemies();
  switch (screen) {
    case "mainMenu": {
      $("#main-content__main-menu-screen-container").show(0);
      break;
    }
    case "singleplayerMenu": {
      $("#main-content__singleplayer-menu-screen-container").show(0);
      break;
    }
    case "gameOver": {
      $("#main-content__game-over-screen-container").show(0);
      break;
    }
    case "canvas": {
      $("#canvas-container").show(0);
      break;
    }
  }
}
changeScreen("mainMenu");

window.onresize = () => {
  redrawStage();
};

export { renderGameData, redrawStage, changeScreen };
