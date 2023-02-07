import FontFaceObserver from "fontfaceobserver";
import * as PIXI from "pixi.js";
import { socket } from "./socket";
import { initializeKeypressEventListener } from "./input";
import * as AS from "adaptive-scale/lib-esm";
import { redrawStage } from "./game";
let startInitTime: number = Date.now();

// Fonts
const serifFont = new FontFaceObserver("Computer Modern Unicode Serif");
const mathFont = new FontFaceObserver("Computer Modern Math Italic");

class ExtendedSprite extends PIXI.Sprite {
  optimalPositionRatio!: {
    x: number;
    y: number;
  };
  scalingPolicy!: AS.POLICY;
  postScalingScale!: {
    x: number;
    y: number;
  };
  scalingAnchor!: {
    x: number;
    y: number;
  };
}

class ExtendedText extends PIXI.Text {
  optimalPositionRatio!: {
    x: number;
    y: number;
  };
  scalingPolicy!: AS.POLICY;
  postScalingScale!: {
    x: number;
    y: number;
  };
  scalingAnchor!: {
    x: number;
    y: number;
  };
}

serifFont.load();
mathFont.load();

const app = new PIXI.Application({
  width: window.screen.width,
  height: window.screen.height,
  backgroundColor: 0x000000,
  resizeTo: window,
  autoDensity: true,
  resolution: devicePixelRatio
});

app.renderer.view.style.position = "absolute";
app.renderer.view.style.display = "block";

const stage = app.stage;

const stageItems: {
  [key: string]: ExtendedSprite | ExtendedText;
} = {
  playFieldBorder: new ExtendedSprite(
    PIXI.Texture.from("assets/images/playfield.png")
  ),
  scoreText: new ExtendedText("0", {
    fontFamily: "Computer Modern Unicode Serif",
    fontSize: 24,
    fill: "#ffffff"
  }),

  inputText: new ExtendedText("0", {
    fontFamily: "Computer Modern Unicode Serif",
    fontSize: 48,
    fill: "#ffffff"
  })
};

function setContainerItemProperties() {
  stageItems.playFieldBorder.scalingPolicy = AS.POLICY.FullWidth;
  // text
  stageItems.scoreText.position.set(850, 835);
  //
  stageItems.inputText.x = 400;
  stageItems.inputText.y = 835;
  stageItems.inputText.anchor.set(0.5, 0.5);
  stageItems.playFieldBorder.scalingPolicy = AS.POLICY.FullWidth;
}

setContainerItemProperties();

for (let item in stageItems) {
  stage.addChild(stageItems[item]);
}

// const renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight);
document.body.appendChild(app.view);

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
