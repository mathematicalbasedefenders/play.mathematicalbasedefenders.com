import FontFaceObserver from "fontfaceobserver";
import * as PIXI from "pixi.js";
import { socket, sendSocketMessage } from "./socket";
import { initializeKeypressEventListener } from "./input";
import * as AS from "adaptive-scale/lib-esm";
import {
  changeScreen,
  changeSettingsSecondaryScreen,
  redrawStage
} from "./game";
import { calculateLevel, millisecondsToTime } from "./utilities";
import {
  ModalNotification,
  ToastNotification,
  ToastNotificationPosition
} from "./notifications";
import { getSettings, loadSettings, setSettings } from "./settings";
let startInitTime: number = Date.now();
const OPTIMAL_SCREEN_WIDTH: number = 1920;
const OPTIMAL_SCREEN_HEIGHT: number = 1080;
const X_POSITION_OFFSET: number = 0;
// Fonts
const serifFont = new FontFaceObserver("Computer Modern Unicode Serif");
const mathFont = new FontFaceObserver("Computer Modern Math Italic");

class ExtendedSprite extends PIXI.Sprite {
  scalingPolicy!: AS.POLICY;
}

class ExtendedText extends PIXI.Text {
  scalingPolicy!: AS.POLICY;
}

serifFont.load();
mathFont.load();

const app = new PIXI.Application({
  width: OPTIMAL_SCREEN_WIDTH,
  height: OPTIMAL_SCREEN_HEIGHT,
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
  // below is for beautifulScoreCounter
  scoreOnLastUpdate: 0,
  playing: false,
  settings: {
    multiplicationSign: "dot",
    beautifulScore: false
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
      fontFamily: "Computer Modern Unicode Serif",
      fontSize: 24,
      fill: "#ffffff"
    }),
    scoreText: new ExtendedText("0", {
      fontFamily: "Computer Modern Unicode Serif",
      fontSize: 72,
      fill: "#ffffff"
    }),
    //
    enemiesText: new ExtendedText("Enemy Kills: 0 ≈ 0.000/s", {
      fontFamily: "Computer Modern Unicode Serif",
      fontSize: 20,
      fill: "#ffffff"
    }),
    inputText: new ExtendedText("0", {
      fontFamily: "Computer Modern Unicode Serif",
      fontSize: 48,
      fill: "#ffffff"
    }),
    elapsedTimeText: new ExtendedText("0:00.000", {
      fontFamily: "Computer Modern Unicode Serif",
      fontSize: 20,
      fill: "#ffffff"
    }),
    baseHealthText: new ExtendedText("♥️ 100", {
      fontFamily: "Computer Modern Unicode Serif",
      fontSize: 20,
      fill: "#ffffff"
    }),
    comboText: new ExtendedText("", {
      fontFamily: "Computer Modern Unicode Serif",
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
  //
  stageItems.sprites.playFieldBorder.position.set(640, 160);
  // text
  stageItems.textSprites.scoreText.position.set(1294, 725);
  //
  stageItems.textSprites.scoreLabelText.position.set(1294, 705);
  stageItems.textSprites.scoreLabelText.text = "Score";
  //
  stageItems.textSprites.enemiesText.text = "Enemy Kills: 0 ≈ 0.000/s";
  stageItems.textSprites.enemiesText.position.set(1294, 795);
  //
  stageItems.textSprites.elapsedTimeText.text = "0:00.000";
  stageItems.textSprites.elapsedTimeText.position.set(1294, 815);
  //
  stageItems.textSprites.baseHealthText.text = "♥️ 100";
  stageItems.textSprites.baseHealthText.position.set(1294, 835);
  //
  stageItems.textSprites.comboText.text = "";
  stageItems.textSprites.comboText.position.set(1294, 855);
  //
  stageItems.textSprites.inputText.position.set(964, 915);
  stageItems.textSprites.inputText.anchor.set(0.5, 0.5);
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
    sendSocketMessage({
      message: "startGame",
      mode: "singleplayer",
      modifier: "easy"
    });
    changeScreen("canvas", true);
  });
  $("#singleplayer-menu-screen-button--standard").on("click", () => {
    variables.cachedSingleplayerMode = "standard";
    sendSocketMessage({
      message: "startGame",
      mode: "singleplayer",
      modifier: "standard"
    });
    changeScreen("canvas", true);
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
  $("#settings__enemy-color__forced-color-picker").on("input", () => {
    let value = $("#settings__enemy-color__forced-color-picker")
      .val()
      ?.toString();
    $("#settings__enemy-color__forced-color").text(value || "#ff0000");
  });
  //
  $("#settings-screen__content--online__submit").on("click", (event) => {
    $.ajax({
      type: "post",
      url: "/authenticate",
      data: {
        username: $("#settings-screen__content--online__username").val(),
        password: $("#settings-screen__content--online__password").val(),
        socketID: $("#settings-screen__content--online__socket-id").val()
      },
      // TODO: refactor
      success: (data) => {
        if (data.good) {
          updateUserInformationText(data);
          // toast notification
          new ToastNotification(
            `Successfully logged in as ${data.username}`,
            ToastNotificationPosition.BOTTOM_RIGHT
          );
        } else {
          new ToastNotification(
            `Unable to log in as ${data.username} (${data.reason})`,
            ToastNotificationPosition.BOTTOM_RIGHT
          );
        }
      }
    });
    event.preventDefault();
  });
  //
  $("#game-over-screen-button--retry").on("click", () => {
    sendSocketMessage({
      message: "startGame",
      mode: "singleplayer",
      modifier: variables.cachedSingleplayerMode
    });
    changeScreen("canvas", true);
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
    let top = onScreenKeyboard.position().top;
    let height = onScreenKeyboard.height() as number;
    console.debug(height);
    if (height > 90) {
      onScreenKeyboard.css({ "top": "+=10px" });
      onScreenKeyboard.height(height - 10);
    }
  });
  $("#on-screen-keyboard-button--increase-size").on("click", () => {
    let onScreenKeyboard = $("#on-screen-keyboard");
    let top = onScreenKeyboard.position().top;
    let height = onScreenKeyboard.height() as number;
    console.debug(height);
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
}

// events
initializeEventListeners();
initializeKeypressEventListener();
// initial states
$(".settings-screen__content--online--unauthenticated").show(0);
$(".settings-screen__content--online--authenticated").hide(0);
$("#main-content__modal-notification-container").hide(0);
$("#on-screen-keyboard-container").hide(0);
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
    isNaN(data.records.easy?.score) ? "N/A" : data.records.easy.score
  );
  $("#user-account-stat--standard-singleplayer-record").text(
    isNaN(data.records.standard?.score) ? "N/A" : data.records.standard.score
  );
  $("#user-account-stat--level").attr("title", `${data.experiencePoints}EXP`);
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
  $("#main-content__user-menu-small-display__level").text(
    `Level ${calculateLevel(data.experiencePoints).level.toString()}`
  );
}

function updateGuestInformationText(data: any) {
  $("#main-content__user-menu-small-display__username").text(data.guestName);
  $("#main-content__user-menu-small-display__level").text(`Level 0`);
}

changeScreen("mainMenu");
loadSettings(localStorage.getItem("settings") || "{}");

// ======
let endInitTime: number = Date.now();
console.log(
  `Initialization completed! (Took ${Math.round(
    endInitTime - startInitTime
  )}ms)`
);

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
  updateGuestInformationText
};
