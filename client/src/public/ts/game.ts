import { stageItems, app } from "./index";
import * as enemies from "./enemies";
import { POLICY, Size, getScaledRect } from "adaptive-scale/lib-esm";
import { millisecondsToTime } from "./utilities";
import { variables } from "./index";
import { Opponent } from "./opponent";
import { resetClientSideVariables, setClientSideRendering } from "./rendering";
import { SlidingText } from "./sliding-text";
import { BezierCurve } from "./bezier";
import * as PIXI from "pixi.js";
import { playSound } from "./sounds";
import { getSettings } from "./settings";
import { directions } from "./arrow-key-navigation";

const OPTIMAL_SCREEN_WIDTH: number = 1920;
const OPTIMAL_SCREEN_HEIGHT: number = 1080;
const OPTIMAL_SCREEN_RATIO: number =
  OPTIMAL_SCREEN_WIDTH / OPTIMAL_SCREEN_HEIGHT;

// TODO: Change `any` to something else.
function renderGameData(data: { [key: string]: any }) {
  // pre actions go here.
  if (data.aborted) {
    variables.playing = false;
  }
  // html updates go here.

  if (data.commands.updateText) {
    for (let command in data.commands.updateText) {
      $(data.commands.updateText[command].value.selector).text(
        data.commands.updateText[command].value.newText
      );
    }
  }

  for (let command in data.commands.changeScreenTo) {
    if (typeof data.commands.changeScreenTo[command]?.value === "string") {
      changeScreen(data.commands.changeScreenTo[command].value);
      return;
    }
  }

  // erase killed enemies
  for (let enemyID of Object.values(data.enemiesToErase)) {
    const enemyToDelete = enemies.getEnemyFromCache(enemyID as string);
    const textToDisplay = enemyToDelete?.getText();
    const positionOfKill = enemyToDelete?.textSprite.position;
    const positionOfDeletion =
      (enemyToDelete?.sPosition || -1) - (enemyToDelete?.speed || 0.1);
    // only for killed enemies AND score display on
    if (
      variables.settings.displayScore === "on" &&
      positionOfDeletion > 0.01 &&
      typeof positionOfKill !== "undefined"
    ) {
      const x = positionOfKill.x;
      const y = positionOfKill.y;
      const slideBezier = new BezierCurve(
        1000,
        [x, y],
        [x, y - 50],
        [x, y - 75],
        [x, y - 100]
      );
      const fadeBezier = new BezierCurve(
        1000,
        [x, y],
        [x + 1, y],
        [x + 0.75, y - 1],
        [x, y - 0.1]
      );
      const slidingText = new SlidingText(
        `+${textToDisplay}`,
        new PIXI.TextStyle({
          fontFamily: "Computer Modern Unicode Serif",
          fill: `#ffffff`
        }),
        slideBezier,
        fadeBezier,
        1000
      );
      slidingText.render();
    }
    // only for enemies who hasn't had their sound played yet
    if (
      typeof enemyToDelete !== "undefined" &&
      !enemyToDelete?.addedKill &&
      !enemyToDelete?.attackedBase
    ) {
      // only for killed enemies
      if (positionOfDeletion > 0.01 && typeof positionOfKill !== "undefined") {
        playSound("assets/sounds/attack.mp3", true);
      }
    }
    enemies.deleteEnemy(enemyID as string);
  }

  for (let enemy of data.enemies) {
    enemies.rerenderEnemy(enemy);
  }

  // multiplayer
  if (data.mode.indexOf("Multiplayer") > -1) {
    // multiplayer
    variables.currentGameMode = "multiplayer";
    stageItems.textSprites.scoreLabelText.text = "Attack Score";
    data.score = data.attackScore;
    for (let opponentData of data.opponentGameData) {
      // check if there is already an opponent game instance rendered with said data
      let renderedInstance = Opponent.instances?.find(
        (element) => element.boundTo === opponentData.owner
      );
      if (typeof renderedInstance === "undefined") {
        let newInstance = new Opponent();
        newInstance.bind(opponentData.owner);
        newInstance.render();
        //
      } else {
        if (opponentData.baseHealth > 0) {
          renderedInstance.update(opponentData);
        }
      }
    }
    for (let opponentData of data.opponentGameData) {
      if (opponentData.baseHealth <= 0) {
        let renderedInstance = Opponent.instances?.find(
          (element) => element.boundTo === opponentData.owner
        );
        let index = Opponent.instances.findIndex(
          (element) => element.boundTo === opponentData.owner
        );
        renderedInstance?.destroy();
        Opponent.instances.splice(index, 1);
        for (let instance of Opponent.instances) {
          instance.autoReposition();
        }
      }
    }
  } else {
    stageItems.textSprites.scoreLabelText.text = "Score";
  }

  // text
  stageItems.textSprites.inputText.text = data.currentInput.replaceAll(
    "-",
    "−"
  );
  stageItems.textSprites.enemiesText.text = `Enemy Kills: ${
    data.enemiesKilled
  } ≈ ${((data.enemiesKilled / data.elapsedTime) * 1000).toFixed(3)}/s`;
  stageItems.textSprites.elapsedTimeText.text = millisecondsToTime(
    data.elapsedTime
  );

  // combo
  variables.currentGameClientSide.currentCombo = data.combo;
  if (data.combo > 0) {
    stageItems.textSprites.comboText.text = `${data.combo} Combo`;
    stageItems.textSprites.comboText.alpha = Math.max(
      0,
      1 - data.clocks.comboReset.currentTime / data.clocks.comboReset.actionTime
    );
  } else {
    stageItems.textSprites.comboText.text = ``;
  }

  // text
  stageItems.textSprites.baseHealthText.text = `♥ ${data.baseHealth}`;
  stageItems.textSprites.nameText.text = data.ownerName;
  // text: multiplayer
  if (typeof data.receivedEnemiesStock === "number") {
    // implies multiplayer game
    stageItems.textSprites.enemiesReceivedStockText.text =
      data.receivedEnemiesStock;
  } else {
    stageItems.textSprites.enemiesReceivedStockText.text = "";
  }

  // update values
  variables.currentGameClientSide.enemiesKilled = data.enemiesKilled;
  variables.currentGameClientSide.comboTime = data.clocks.comboReset.actionTime;
  variables.currentGameClientSide.timeSinceLastEnemyKill =
    data.clocks.comboReset.currentTime;
  variables.currentGameClientSide.baseHealth = data.baseHealth;
  variables.currentGameClientSide.currentInput = data.currentInput;
  variables.currentGameClientSide.level = data.level;
  variables.currentGameClientSide.enemySpeedCoefficient =
    data.enemySpeedCoefficient;
  // beautiful score setting
  // if (variables.settings.beautifulScore === "on") {
  //   let currentDisplayedScore = parseInt(stageItems.textSprites.scoreText.text);
  //   if (data.score !== currentDisplayedScore) {
  //     if (variables.scoreOnLastUpdate !== data.score) {
  //       variables.scoreOnLastUpdate = data.score;
  //     }
  //     let difference = variables.scoreOnLastUpdate - currentDisplayedScore;
  //     stageItems.textSprites.scoreText.text =
  //       currentDisplayedScore + Math.round(difference / 60);
  //     if (data.score < currentDisplayedScore * 1.1) {
  //       stageItems.textSprites.scoreText.text = data.score;
  //     }
  //   }
  // } else {
  stageItems.textSprites.scoreText.text = data.score;
  // }

  // level display for singleplayer
  if (
    data.mode.indexOf("Singleplayer") > -1 &&
    data.mode.indexOf("custom") == -1
  ) {
    switch (variables.settings.displayLevel) {
      case "low": {
        stageItems.textSprites.levelText.text = `Level ${data.level}`;
        stageItems.textSprites.levelDetailsText.text = "";
        break;
      }
      case "medium": {
        const lm1 = data.level - 1;
        const scoreMultiplier = Math.max(1, 1 + 0.1 * lm1).toFixed(3);
        const toNext = data.enemiesToNextLevel;
        stageItems.textSprites.levelText.text = `Level ${data.level}: Score ×${scoreMultiplier}, To Next: ${toNext}`;
        stageItems.textSprites.levelDetailsText.text = "";
        break;
      }
      case "high":
      default: {
        const lm1 = data.level - 1;
        const scoreMultiplier = Math.max(1, 1 + 0.1 * lm1).toFixed(3);
        const toNext = data.enemiesToNextLevel;
        const baseHeal = data.baseHealthRegeneration.toFixed(3);
        const enemySpeed = data.enemySpeedCoefficient.toFixed(3);
        const enemyChance = (data.enemySpawnThreshold * 100).toFixed(3);
        const enemyTime = data.clocks.enemySpawn.actionTime.toFixed(3);
        stageItems.textSprites.levelText.text = `Level ${data.level}: Score ×${scoreMultiplier}, To Next: ${toNext}`;
        stageItems.textSprites.levelDetailsText.text = `+♥: ${baseHeal}/s, ■↓: ×${enemySpeed}, +■: ${enemyChance}% every ${enemyTime}ms`;
        break;
      }
    }
  } else {
    stageItems.textSprites.levelText.text = "";
    stageItems.textSprites.levelDetailsText.text = "";
  }

  // multiplayer intermission
  if (data.mode.indexOf("Multiplayer") > -1) {
    if (data.aborted) {
      changeScreen("mainMenu");
    } else if (data.baseHealth <= 0) {
      changeScreen("multiplayerIntermission");
    }
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

function changeScreen(
  screen: string,
  alsoRedrawStage?: boolean,
  alsoResetStage?: boolean,
  newData?: { [key: string]: any }
) {
  // set settings
  getSettings(localStorage.getItem("settings") || "{}");

  $("#main-content__main-menu-screen-container").hide(0);
  $("#main-content__singleplayer-menu-screen-container").hide(0);
  $("#main-content__custom-singleplayer-intermission-screen-container").hide(0);
  $("#main-content__multiplayer-menu-screen-container").hide(0);
  $("#main-content__multiplayer-intermission-screen-container").hide(0);
  $("#main-content__game-over-screen-container").hide(0);
  $("#main-content__settings-screen-container").hide(0);
  $("#canvas-container").hide(0);
  // other stuff
  if (alsoRedrawStage) {
    redrawStage();
  }
  if (alsoResetStage) {
    resetClientSideVariables();
  }
  if (newData) {
    setClientSideRendering(newData);
  }
  // set new screen
  variables.navigation.focusing = directions[screen]?.defaultFocused;
  variables.navigation.currentScreen = screen;
  // reset stuff
  // TODO: temporary
  for (let opponent of Opponent.instances) {
    opponent.destroyAllInstances();
  }
  enemies.deleteAllEnemies();
  enemies.Enemy.enemiesDrawn = []; // TODO: Consider moving this to specific screens only.
  // actually change screen
  switch (screen) {
    case "mainMenu": {
      $("#main-content__main-menu-screen-container").show(0);
      break;
    }
    case "singleplayerMenu": {
      $("#main-content__singleplayer-menu-screen-container").show(0);
      break;
    }
    case "customSingleplayerIntermission": {
      $(
        "#main-content__custom-singleplayer-intermission-screen-container"
      ).show(0);
      break;
    }
    case "multiplayerMenu": {
      $("#main-content__multiplayer-menu-screen-container").show(0);
      break;
    }
    case "multiplayerIntermission": {
      $("#main-content__multiplayer-intermission-screen-container").show(0);
      break;
    }
    case "settingsMenu": {
      $("#main-content__settings-screen-container").show(0);
      changeSettingsSecondaryScreen("");
      break;
    }
    case "gameOver": {
      variables.playing = false;
      $("#main-content__game-over-screen-container").show(0);
      break;
    }
    case "canvas": {
      $("#canvas-container").show(0);
      // TODO: move this somewhere else
      variables.playing = true;
      break;
    }
  }
}

function changeSettingsSecondaryScreen(newScreen: string) {
  for (let screen of ["online", "audio", "video"]) {
    $(`#settings-screen__content--${screen}`).hide(0);
  }
  $(`#settings-screen__content--${newScreen}`).show(0);
}

function changeCustomSingleplayerSecondaryScreen(newScreen: string) {
  for (let screen of ["global", "enemies", "base"]) {
    $(`#custom-singleplayer-intermission-screen__content--${screen}`).hide(0);
  }
  $(`#custom-singleplayer-intermission-screen__content--${newScreen}`).show(0);
}

function createCustomSingleplayerGameObject() {
  // TODO: funny hack lol, make cleaner
  let bp = "#custom-singleplayer-game__";
  let toReturn = {
    baseHealth: $(`${bp}starting-base-health`).val(),
    comboTime: $(`${bp}combo-time`).val(),
    enemySpeedCoefficient: $(`${bp}enemy-speed-coefficient`).val(),
    enemySpawnTime: $(`${bp}enemy-spawn-time`).val(),
    enemySpawnChance: $(`${bp}enemy-spawn-chance`).val(),
    forcedEnemySpawnTime: $(`${bp}forced-enemy-spawn-time`).val()
  };
  return toReturn;
}

window.onresize = () => {
  redrawStage();
};

export {
  renderGameData,
  redrawStage,
  changeScreen,
  changeSettingsSecondaryScreen,
  createCustomSingleplayerGameObject,
  changeCustomSingleplayerSecondaryScreen
};
