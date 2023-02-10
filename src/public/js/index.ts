import FontFaceObserver from "fontfaceobserver";
import * as PIXI from "pixi.js";
import { socket, sendSocketMessage } from "./socket";
import { initializeKeypressEventListener } from "./input";
import * as AS from "adaptive-scale/lib-esm";
import { changeScreen, redrawStage } from "./game";
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
// other event listeners
$("#main-menu-screen-button--singleplayer").on("click", () => {
  changeScreen("singleplayerMenu");
});
//
$("#singleplayer-menu-screen-button--back").on("click", () => {
  changeScreen("mainMenu");
});
$("#singleplayer-menu-screen-button--easy").on("click", () => {
  sendSocketMessage("start", ["singleplayer", "easy"]);
  changeScreen("canvas", true);
});
$("#singleplayer-menu-screen-button--standard").on("click", () => {
  sendSocketMessage("start", ["singleplayer", "standard"]);
  changeScreen("canvas", true);
});
//
$("#main-content__game-over-screen__retry-button").on("click", () => {
  sendSocketMessage("start", "singleplayer");
  changeScreen("canvas", true);
});

// events
initializeKeypressEventListener();
// initial states
redrawStage();
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
  mathFont
};
