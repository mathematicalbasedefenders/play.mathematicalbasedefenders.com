import FontFaceObserver from "fontfaceobserver";
import * as PIXI from "pixi.js";
import { socket, sendSocketMessage } from "./socket";
import { initializeKeypressEventListener } from "./input";
import * as AS from "adaptive-scale/lib-esm";
import {
  changeCustomSingleplayerSecondaryScreen,
  changeScreen,
  changeSettingsSecondaryScreen,
  createCustomSingleplayerGameObject,
  redrawStage
} from "./game";
import { calculateLevel, millisecondsToTime } from "./utilities";
import { render, setClientSideRendering } from "./rendering";
import { getSettings, loadSettings, setSettings } from "./settings";
import { PopupNotification, ToastNotification } from "./notifications";
import { changeBackgroundImage } from "./change-background-image";
let startInitTime: number = Date.now();
//
const OPTIMAL_SCREEN_WIDTH: number = 1920;
const OPTIMAL_SCREEN_HEIGHT: number = 1080;
// Positions
const STATISTICS_POSITION: number = 1294;
// Fonts
const serifFont = new FontFaceObserver("Computer Modern Unicode Serif");
const mathFont = new FontFaceObserver("Computer Modern Math Italic");
const notoFont = new FontFaceObserver("Noto Sans");

class ExtendedSprite extends PIXI.Sprite {
  scalingPolicy!: AS.POLICY;
}

class ExtendedText extends PIXI.Text {
  scalingPolicy!: AS.POLICY;
}

serifFont.load();
mathFont.load();
notoFont.load();

const app = new PIXI.Application({
  width: OPTIMAL_SCREEN_WIDTH,
  height: OPTIMAL_SCREEN_HEIGHT,
  backgroundAlpha: 0,
  backgroundColor: 0x000000,
  resizeTo: window,
  autoDensity: true,
  resolution: devicePixelRatio
});

app.renderer.view.style.position = "absolute";
app.renderer.view.style.display = "block";

const stage = app.stage;

const variables: { [key: string]: any } = {
  onScreenKeyboardActivated: false,
  cachedSingleplayerMode: null,
  beautifulScoreCounter: true,
  currentGameMode: null,
  // below is for how to play
  howToPlayGamesRemaining: 5,
  // below is for beautifulScoreCounter
  scoreOnLastUpdate: 0,
  playing: false,
  serverReportsPlaying: false,
  settings: {
    multiplicationSign: "dot",
    beautifulScore: false
  },
  enemyInstancesPerColumn: 2,
  enemyInstancePositions: {
    x: {
      initial: 120,
      increment: 240
    },
    y: {
      initial: 160,
      increment: 336
    }
  },
  currentGameClientSide: {
    currentInput: "",
    totalElapsedMilliseconds: 0,
    baseHealth: 0,
    enemiesKilled: 0,
    comboTime: 0,
    currentCombo: 0,
    timeSinceLastEnemyKill: 60 * 1000 + 1,
    level: 0,
    enemySpeedCoefficient: 1,
    shownScore: 0,
    beautifulScoreDisplayGoal: 0,
    beautifulScoreDisplayProgress: 0,
    beautifulScoreDisplayPrevious: 0
  },
  navigation: {
    currentScreen: "mainMenu",
    currentSecondaryScreen: null,
    focusing: null
  }
};

type stageItemsContainer = {
  sprites: { [key: string]: ExtendedSprite };
  textSprites: { [key: string]: ExtendedText };
};

const stageItems: stageItemsContainer = {
  sprites: {
    playFieldBorder: new ExtendedSprite(
      PIXI.Texture.from("assets/images/playfield.png")
    ),
    screenTopLeftIndicator: new ExtendedSprite(PIXI.Texture.WHITE),
    screenBottomRightIndicator: new ExtendedSprite(PIXI.Texture.WHITE)
  },
  textSprites: {
    scoreLabelText: new ExtendedText("Score", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 24,
      fill: "#ffffff"
    }),
    scoreText: new ExtendedText("0", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 80,
      fill: "#ffffff"
    }),
    //
    enemiesText: new ExtendedText("Enemy Kills: 0 ≈ 0.000/s", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 24,
      fill: "#ffffff"
    }),
    inputText: new ExtendedText("0", {
      fontFamily: ["Computer Modern Unicode Serif", "serif"],
      fontSize: 48,
      fill: "#ffffff"
    }),
    elapsedTimeText: new ExtendedText("0:00.000", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 24,
      fill: "#ffffff"
    }),
    baseHealthText: new ExtendedText("♥️ 100", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 24,
      fill: "#ffffff"
    }),
    comboText: new ExtendedText("", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 24,
      fill: "#ffffff"
    }),
    enemiesReceivedStockText: new ExtendedText("0", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 64,
      fill: "#ffffff"
    }),
    nameText: new ExtendedText("", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 20,
      fill: "#ffffff"
    }),
    levelText: new ExtendedText("Level", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 32,
      fill: "#ffffff"
    }),
    levelDetailsText: new ExtendedText("Level", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 20,
      fill: "#ffffff"
    }),
    howToPlayText: new ExtendedText("", {
      fontFamily: ["Noto Sans", "sans-serif"],
      fontSize: 20,
      fill: "#ffffff"
    })
  }
};

function setContainerItemProperties() {
  stageItems.sprites.screenTopLeftIndicator.position.set(0, 0);
  stageItems.sprites.screenTopLeftIndicator.alpha = 0;
  stageItems.sprites.screenBottomRightIndicator.position.set(1920, 1080);
  stageItems.sprites.screenBottomRightIndicator.alpha = 0;
  // playfield
  stageItems.sprites.playFieldBorder.position.set(640, 160);
  // text
  stageItems.textSprites.scoreText.position.set(STATISTICS_POSITION, 706);
  // score label
  stageItems.textSprites.scoreLabelText.position.set(STATISTICS_POSITION, 690);
  stageItems.textSprites.scoreLabelText.text = "Score";
  // enemies/s
  stageItems.textSprites.enemiesText.text = "Enemy Kills: 0 ≈ 0.000/s";
  stageItems.textSprites.enemiesText.position.set(STATISTICS_POSITION, 788);
  // time
  stageItems.textSprites.elapsedTimeText.text = "0:00.000";
  stageItems.textSprites.elapsedTimeText.position.set(STATISTICS_POSITION, 814);
  // base health
  stageItems.textSprites.baseHealthText.text = "♥️ 100";
  stageItems.textSprites.baseHealthText.position.set(STATISTICS_POSITION, 840);
  // combo
  stageItems.textSprites.comboText.text = "";
  stageItems.textSprites.comboText.position.set(STATISTICS_POSITION, 866);
  // input
  stageItems.textSprites.inputText.position.set(964, 915);
  stageItems.textSprites.inputText.anchor.set(0.5, 0.5);
  // enemies stock
  stageItems.textSprites.enemiesReceivedStockText.text = "";
  stageItems.textSprites.enemiesReceivedStockText.position.set(
    STATISTICS_POSITION,
    525
  );
  // username
  stageItems.textSprites.nameText.text = "";
  stageItems.textSprites.nameText.position.set(964, 983);
  stageItems.textSprites.nameText.anchor.set(0.5, 0.5);
  // level
  stageItems.textSprites.levelText.text = "Level 1";
  stageItems.textSprites.levelText.position.set(STATISTICS_POSITION, 595);
  // level details
  stageItems.textSprites.levelDetailsText.text =
    "+♥: ?/s, ↓: ×1.00, ■: 5% every 1000ms";
  stageItems.textSprites.levelDetailsText.position.set(
    STATISTICS_POSITION,
    630
  );
  // how to play
  stageItems.textSprites.howToPlayText.text = "Tutorial:\n";
  stageItems.textSprites.howToPlayText.text +=
    "Type the number on the enemy or the answer to an expression on an enemy\n";
  stageItems.textSprites.howToPlayText.text +=
    "with the number row or your numpad on your keyboard.\n";
  stageItems.textSprites.howToPlayText.text +=
    "Press Space or Enter to submit an answer.\n";
  stageItems.textSprites.howToPlayText.text +=
    "This will go away after 5 more games in this session.\n";
  stageItems.textSprites.howToPlayText.text +=
    "You can also turn off this message in the settings.\n";
  stageItems.textSprites.howToPlayText.position.set(STATISTICS_POSITION, 400);
}

setContainerItemProperties();

for (let item in stageItems.sprites) {
  app.stage.addChild(stageItems.sprites[item]);
}
for (let item in stageItems.textSprites) {
  app.stage.addChild(stageItems.textSprites[item]);
}

// const renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight);
document.getElementById("canvas-container")?.appendChild(app.view);
function initializeEventListeners() {
  // other event listeners
  $("#main-menu-screen-button--singleplayer").on("click", () => {
    changeScreen("singleplayerMenu");
  });
  $("#main-menu-screen-button--multiplayer").on("click", () => {
    changeScreen("multiplayerMenu");
  });
  $("#main-menu-screen-button--settings").on("click", () => {
    getSettings(localStorage.getItem("settings") || "{}");
    changeScreen("settingsMenu");
  });
  //
  $("#singleplayer-menu-screen-button--back").on("click", () => {
    changeScreen("mainMenu");
  });
  $("#singleplayer-menu-screen-button--easy").on("click", () => {
    variables.cachedSingleplayerMode = "easy";
    variables.currentGameMode = "singleplayer";
    sendSocketMessage({
      message: "startGame",
      mode: "singleplayer",
      modifier: "easy"
    });
    changeScreen("canvas", true, true);
  });
  $("#singleplayer-menu-screen-button--standard").on("click", () => {
    variables.cachedSingleplayerMode = "standard";
    variables.currentGameMode = "singleplayer";
    sendSocketMessage({
      message: "startGame",
      mode: "singleplayer",
      modifier: "standard"
    });
    changeScreen("canvas", true, true);
  });
  //
  $("#singleplayer-menu-screen-button--custom").on("click", () => {
    changeScreen("customSingleplayerIntermission");
  });
  $("#custom-singleplayer-intermission-screen-container__back-button").on(
    "click",
    () => {
      changeScreen("mainMenu");
    }
  );
  $("#custom-singleplayer-intermission-screen-container__start-button").on(
    "click",
    // FIXME: Clicking this doesn't reset the text fields, so it is a hack. Make it more stable
    () => {
      variables.cachedSingleplayerMode = "custom";
      let settings = JSON.stringify(createCustomSingleplayerGameObject());
      sendSocketMessage({
        message: "startGame",
        mode: "singleplayer",
        modifier: "custom",
        settings: settings
      });
      setClientSideRendering(JSON.parse(settings));
    }
  );
  //
  $("#multiplayer-menu-screen-button--default").on("click", () => {
    sendSocketMessage({
      message: "joinMultiplayerRoom",
      room: "default"
    });
    changeScreen("multiplayerIntermission");
  });
  $("#multiplayer-menu-screen-button--back").on("click", () => {
    changeScreen("mainMenu");
  });
  //
  $("#settings-screen__sidebar-item--back").on("click", () => {
    setSettings();
    changeScreen("mainMenu");
  });
  $("#settings-screen__sidebar-item--online").on("click", () => {
    changeSettingsSecondaryScreen("online");
  });
  $("#settings-screen__sidebar-item--audio").on("click", () => {
    changeSettingsSecondaryScreen("audio");
  });
  $("#settings-screen__sidebar-item--video").on("click", () => {
    changeSettingsSecondaryScreen("video");
  });
  //
  $("#settings__enemy-color__forced-color-picker").on("input", () => {
    let value = $("#settings__enemy-color__forced-color-picker")
      .val()
      ?.toString();
    $("#settings__enemy-color__forced-color").text(value || "#ff0000");
  });
  //
  $("#custom-singleplayer-intermission-screen-container__global-button").on(
    "click",
    () => {
      changeCustomSingleplayerSecondaryScreen("global");
    }
  );
  $("#custom-singleplayer-intermission-screen-container__enemies-button").on(
    "click",
    () => {
      changeCustomSingleplayerSecondaryScreen("enemies");
    }
  );
  $("#custom-singleplayer-intermission-screen-container__base-button").on(
    "click",
    () => {
      changeCustomSingleplayerSecondaryScreen("base");
    }
  );
  //
  $("#settings-screen__content--online__submit").on("click", async (event) => {
    // FIXME: possibly unsafe
    const url = `${location.protocol}//${location.hostname}${
      location.protocol === "http:" ? ":4000" : ""
    }/authenticate`;
    await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        username: $("#settings-screen__content--online__username").val(),
        password: $("#settings-screen__content--online__password").val(),
        socketID: $("#settings-screen__content--online__socket-id").val()
      }),
      headers: { "Content-Type": "application/json" }
    });
    event.preventDefault();
  });
  //
  $("#settings-screen__content-save-background-image").on(
    "click",
    async (event) => {
      const url = $("#settings__background-image-url").val() as string;
      changeBackgroundImage(url);
    }
  );
  //
  $("#game-over-screen-button--retry").on("click", () => {
    let settings = JSON.stringify(createCustomSingleplayerGameObject());
    if (variables.cachedSingleplayerMode === "custom") {
      sendSocketMessage({
        message: "startGame",
        mode: "singleplayer",
        modifier: "custom",
        settings: settings
      });
      changeScreen("canvas", true, true, JSON.parse(settings));
    } else {
      sendSocketMessage({
        message: "startGame",
        mode: "singleplayer",
        modifier: variables.cachedSingleplayerMode
      });
      changeScreen("canvas", true, true);
    }
  });
  $("#game-over-screen-button--back").on("click", () => {
    changeScreen("mainMenu");
  });
  //
  $("#quick-menu__toggle-button").on("click", () => {
    $("#quick-menu__content-container").toggle(0);
  });
  //
  $("#quick-menu__content-button--quit").on("click", () => {
    variables.playing = false;
    sendSocketMessage({
      message: "emulateKeypress",
      emulatedKeypress: "Escape"
    });
    changeScreen("mainMenu");
  });
  $("#quick-menu__content-button--settings").on("click", () => {
    getSettings(localStorage.getItem("settings") || "{}");
    changeScreen("settingsMenu");
  });
  $("#quick-menu__content-button--on-screen-keyboard").on("click", () => {
    variables.onScreenKeyboardActivated = !variables.onScreenKeyboardActivated;
    $("#on-screen-keyboard-container").toggle(0);
  });
  //
  $("#on-screen-keyboard-button--decrease-size").on("click", () => {
    let onScreenKeyboard = $("#on-screen-keyboard");
    let height = onScreenKeyboard.height() as number;
    if (height > 90) {
      onScreenKeyboard.css({ "top": "+=10px" });
      onScreenKeyboard.height(height - 10);
    }
  });
  $("#on-screen-keyboard-button--increase-size").on("click", () => {
    let onScreenKeyboard = $("#on-screen-keyboard");
    let height = onScreenKeyboard.height() as number;
    if (height < 240) {
      onScreenKeyboard.css({ "top": "-=10px" });
      onScreenKeyboard.height(height + 10);
    }
  });
  //
  for (let i = 0; i <= 9; i++) {
    $(`#on-screen-keyboard__button-${i}`).on("click", () => {
      sendSocketMessage({
        message: "emulateKeypress",
        emulatedKeypress: `Digit${i}`
      });
    });
  }
  $("#on-screen-keyboard__button-minus").on("click", () => {
    sendSocketMessage({
      message: "emulateKeypress",
      emulatedKeypress: `Minus`
    });
  });
  $(`#on-screen-keyboard__button-send`).on("click", () => {
    sendSocketMessage({
      message: "emulateKeypress",
      emulatedKeypress: `Space`
    });
  });
  $(`#on-screen-keyboard__button-delete`).on("click", () => {
    sendSocketMessage({
      message: "emulateKeypress",
      emulatedKeypress: `Backspace`
    });
  });
  $(`#message-send-button`).on("click", () => {
    sendSocketMessage({
      message: "sendChatMessage",
      scope: "room",
      chatMessage: $("#chat-message").val()?.toString() || ""
    });
    $("#chat-message").val("");
  });
  $(`#chat-tray-input-send-button`).on("click", () => {
    sendSocketMessage({
      message: "sendChatMessage",
      scope: "global",
      chatMessage: $("#chat-tray-input").val()?.toString() || ""
    });
    $("#chat-tray-input").val("");
  });
  $(`#main-content__user-menu-small-display`).on("click", () => {
    changeScreen("settingsMenu");
    changeSettingsSecondaryScreen("online");
  });
}

// events
initializeEventListeners();
initializeKeypressEventListener();
// initial states
$(".settings-screen__content--online--unauthenticated").show(0);
$(".settings-screen__content--online--authenticated").hide(0);
$("#main-content__popup-notification-container").hide(0);
changeCustomSingleplayerSecondaryScreen("");
$("#on-screen-keyboard-container").hide(0);
$("#settings-screen__content--online__login-form").on("submit", (event) => {
  event?.preventDefault();
});
redrawStage();

function updateUserInformationText(data: any) {
  // === SETTINGS SCREEN ===
  $("#settings-screen__content--online__rank").text(data.rank.title);
  $("#settings-screen__content--online__rank").css("color", data.rank.color);
  $("#settings-screen__content--online__authenticated-username").text(
    data.username
  );
  //
  $(".settings-screen__content--online--unauthenticated").hide(0);
  $(".settings-screen__content--online--authenticated").show(0);
  //
  $("#user-account-stat--username").text(data.username);
  $("#user-account-stat--rank").text(data.rank.title);
  $("#user-account-stat--level").text(
    `${calculateLevel(data.experiencePoints).level.toString()} (${
      (calculateLevel(data.experiencePoints).progressToNext * 100)
        .toFixed(3)
        .toString() || 0
    }% to next)`
  );
  $("#user-account-stat--easy-singleplayer-record").text(
    Number.isNaN(data.records.easy?.score)
      ? "N/A"
      : data.records.easy.score.toLocaleString("en-US")
  );
  $("#user-account-stat--standard-singleplayer-record").text(
    Number.isNaN(data.records.standard?.score)
      ? "N/A"
      : data.records.standard.score.toLocaleString("en-US")
  );
  $("#user-account-stat--level").attr(
    "title",
    `${data.experiencePoints.toLocaleString("en-US")}EXP`
  );
  $("#user-account-stat--easy-singleplayer-record").attr(
    "title",
    `${millisecondsToTime(data.records.easy.timeInMilliseconds)}, ${
      data.records.easy.enemiesKilled
    }/${data.records.easy.enemiesCreated}, ${
      data.records.easy.scoreSubmissionDateAndTime
    }`
  );
  $("#user-account-stat--standard-singleplayer-record").attr(
    "title",
    `${millisecondsToTime(data.records.standard.timeInMilliseconds)}, ${
      data.records.standard.enemiesKilled
    }/${data.records.standard.enemiesCreated}, ${
      data.records.standard.scoreSubmissionDateAndTime
    }`
  );
  // ===
  // === USER MENU ===
  $("#main-content__user-menu-small-display__rank").text(data.rank.title);
  $("#main-content__user-menu-small-display__rank").css(
    "color",
    data.rank.color
  );
  $("#main-content__user-menu-small-display__username").text(data.username);
  let level = calculateLevel(data.experiencePoints);
  $("#main-content__user-menu-small-display__level").text(
    `Level ${level.level} (${((level.progressToNext || 0) * 100).toFixed(
      3
    )}% to next)`
  );
}

function updateGuestInformationText(data: any) {
  $("#main-content__user-menu-small-display__username").text(data.guestName);
  $("#main-content__user-menu-small-display__level").text(
    `Level 0 (Signed out, click to log in!)`
  );
}

app.ticker.add((deltaTime) => {
  render(app.ticker.elapsedMS);
});

changeScreen("mainMenu");
loadSettings(localStorage.getItem("settings") || "{}");

// ======
window.addEventListener("load", function () {
  const endInitTime: number = Date.now();
  // initialize some settings
  if (variables.settings.backgroundImage) {
    changeBackgroundImage(variables.settings.backgroundImage);
  }
  console.log(
    `Initialization completed! (Took ${Math.round(
      endInitTime - startInitTime
    )}ms)`
  );
  new PopupNotification(
    "Hello!",
    `<p style="font-size:20px">Thank you for trying out Mathematical Base Defenders! 
    <br>
    A couple of things to note:
    <ul>
    <li>Mathematical Base Defenders is currently in its testing stage, therefore: 
    <ul>
    <li>Game content is incomplete and subject to change.</li>
    <li>Current product is NOT indicative of final product.</li>
    <li>There will be lots of bugs and performance issues.</li>
    </ul>
    </li>
    <li>This game is best played with a keyboard. However, if you don't have one, there is a "virtual" on-screen keyboard available. These might be slow on tablets and phones.</li>
    <li>To log in to your user account, go to <code>Settings</code>, then <code>Online</code>.</li>
    <li>To register for an account, go to the accompanying website <a class="text--link" href="https://mathematicalbasedefenders.com">here</a>.</li>
    <li>To request a feature, report a bug or to contribute, please do so in the game's communication channels available on the accompanying website.</li>
    <li><b>As of 0.4.10, to prevent abuse of server resources, please do not mash the keys on your keyboard, as it may lead to anticheat falsely flagging and disconnecting you. A future update will make this anticheat function more accurate. (Don't worry, getting flagging for this reason has no punishment)</b></li>
    </ul>
    Thank you for playing!</p>`,
    1
  );
});

export {
  socket,
  stageItems,
  stage,
  app,
  ExtendedSprite,
  ExtendedText,
  serifFont,
  mathFont,
  variables,
  updateGuestInformationText,
  updateUserInformationText
};
