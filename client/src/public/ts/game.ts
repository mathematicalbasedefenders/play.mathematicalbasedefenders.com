import { stageItems, app } from "./index";
import * as enemies from "./enemies";
import { POLICY, Size, getScaledRect } from "adaptive-scale/lib-esm";
import { millisecondsToTime } from "./utilities";
import { variables } from "./index";
import { Opponent } from "./opponent";
import {
  flashInputArea,
  resetClientSideVariables,
  setClientSideRendering
} from "./rendering";
import { SlidingText } from "./sliding-text";
import { BezierCurve } from "./bezier";
import * as PIXI from "pixi.js";
import { playSound } from "./sounds";
import { getSettings } from "./settings";
import { getArrowKeyDirections } from "./arrow-key-navigation";
import { formatHowToPlayText } from "./how-to-play";

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

  let enemiesKilled = 0;
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
      positionOfDeletion > 0.0001 &&
      typeof positionOfKill !== "undefined"
    ) {
      const x = positionOfKill.x;
      const y = positionOfKill.y;
      const slideBezier = new BezierCurve(
        1000,
        [x, y],
        [x, y - 70],
        [x, y - 95],
        [x, y - 100]
      );
      const fadeBezier = new BezierCurve(
        1000,
        [1.5, 1.5],
        [0.666, 0.666],
        [0.333, 0.333],
        [0, 0]
      );
      const slidingText = SlidingText.getOrCreate(
        `+${textToDisplay}`,
        new PIXI.TextStyle({
          fontFamily: ["Noto Sans", "sans-serif"],
          fill: `#ffffff`
        }),
        slideBezier,
        fadeBezier,
        1000,
        enemyID as string
      );
      slidingText.render();
    }
    // only for enemies who hasn't had their kill counted yet
    if (
      typeof enemyToDelete !== "undefined" &&
      !enemyToDelete?.addedKill &&
      !enemyToDelete?.attackedBase
    ) {
      // only for killed enemies
      if (
        positionOfDeletion > 0.0001 &&
        typeof positionOfKill !== "undefined"
      ) {
        playSound("assets/sounds/attack.mp3", true);
      }
    }

    if (positionOfDeletion > 0.0001 && typeof positionOfKill !== "undefined") {
      enemiesKilled++;
    }

    enemies.deleteEnemy(enemyID as string);
  }

  const flashAreaOn = variables.settings.flashInputAreaOnEnemyKill === "on";
  if (enemiesKilled > 0 && flashAreaOn) {
    flashInputArea();
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

  stageItems.textSprites.enemiesText.text = `Enemy Kills: ${data.enemiesKilled.toLocaleString(
    "en-US"
  )} ≈ ${((data.enemiesKilled / data.elapsedTime) * 1000).toFixed(3)}/s`;
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
  if (data.mode.indexOf("Multiplayer") > -1) {
    stageItems.textSprites.enemiesReceivedStockText.text =
      data.receivedEnemiesStock;
  } else {
    stageItems.textSprites.enemiesReceivedStockText.text = "";
  }
  // hide how to play text regardless
  formatHowToPlayText(
    variables.howToPlayGamesRemaining,
    data.mode.indexOf("Multiplayer") > -1 || variables.replay.watchingReplay
  );

  // update values
  if (
    variables.currentGameClientSide.beautifulScoreDisplayGoal !== data.score
  ) {
    variables.currentGameClientSide.beautifulScoreDisplayPrevious = Math.round(
      Number.parseFloat(
        stageItems.textSprites.scoreText.text.replace(/[^\d.-]/g, "")
      )
    );
    variables.currentGameClientSide.beautifulScoreDisplayProgress = 0;
  }

  variables.currentGameClientSide.enemiesKilled = data.enemiesKilled;
  variables.currentGameClientSide.comboTime = data.clocks.comboReset.actionTime;
  variables.currentGameClientSide.timeSinceLastEnemyKill =
    data.clocks.comboReset.currentTime;
  variables.currentGameClientSide.baseHealth = data.baseHealth;
  variables.currentGameClientSide.level = data.level;
  variables.currentGameClientSide.enemySpeedCoefficient =
    data.enemySpeedCoefficient;
  variables.currentGameClientSide.beautifulScoreDisplayGoal = data.score;
  variables.currentGameClientSide.shownScore = data.score;
  variables.currentGameClientSide.timestampOfSynchronization =
    data.timestampOfSynchronization;
  variables.currentGameClientSide.synchronizedInput = data.currentInput;

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
  // reset arrow key navigation
  // remove old element's focus status
  $(variables.navigation.focusing).removeClass("button--arrow-key-focused");

  // set settings
  getSettings(localStorage.getItem("settings") || "{}");

  $("#main-content__main-menu-screen-container").hide(0);
  $("#main-content__singleplayer-menu-screen-container").hide(0);
  $("#main-content__custom-singleplayer-intermission-screen-container").hide(0);
  $("#main-content__multiplayer-menu-screen-container").hide(0);
  $("#main-content__multiplayer-intermission-screen-container").hide(0);
  $("#main-content__game-over-screen-container").hide(0);
  $("#main-content__settings-screen-container").hide(0);
  $("#main-content__archive-screen-container").hide(0);
  $("#canvas-container").hide(0);

  $("#replay-controller-container").hide(0);

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
  variables.navigation.focusing =
    getArrowKeyDirections()[screen]?.defaultFocused;
  variables.navigation.currentScreen = screen;
  // reset stuff
  // remove old element's focus status
  const oldElement = $(variables.navigation.focusing);
  if (oldElement) {
    oldElement.removeClass("button--arrow-key-focused");
  }
  variables.navigation.focusing = null;
  variables.replay.paused = false;
  // TODO: temporary
  Opponent.destroyAllInstances();
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
      // also move these as well
      variables.howToPlayGamesRemaining--;
      formatHowToPlayText(variables.howToPlayGamesRemaining);
      break;
    }
    case "canvas": {
      formatHowToPlayText(variables.howToPlayGamesRemaining);
      $("#canvas-container").show(0);
      // TODO: move this somewhere else
      variables.playing = true;
      break;
    }
    case "archiveMenu": {
      $("#main-content__archive-screen-container").show(0);
      break;
    }
  }
}

function changeSettingsSecondaryScreen(newScreen: string) {
  for (let screen of ["online", "audio", "video"]) {
    $(`#settings-screen__content--${screen}`).hide(0);
  }
  $(`#settings-screen__content--${newScreen}`).show(0);
  variables.navigation.currentSecondaryScreen = newScreen;
}

function changeCustomSingleplayerSecondaryScreen(newScreen: string) {
  for (let screen of ["global", "enemies", "base"]) {
    $(`#custom-singleplayer-intermission-screen__content--${screen}`).hide(0);
  }
  $(`#custom-singleplayer-intermission-screen__content--${newScreen}`).show(0);
  variables.navigation.currentSecondaryScreen = newScreen;
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
