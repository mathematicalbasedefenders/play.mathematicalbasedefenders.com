import FontFaceObserver from "fontfaceobserver";
import * as PIXI from "pixi.js";
import { socket } from "./socket";
import { renderGameData } from "./game";
import { POLICY, Size, getScaledRect } from "adaptive-scale/lib-esm";

let startInitTime: number = Date.now();

// Fonts
const serifFont = new FontFaceObserver("Computer Modern Unicode Serif");
const mathFont = new FontFaceObserver("Computer Modern Math Italic");

class ExtendedSprite extends PIXI.Sprite {
  optimalPositionRatio!: {
    x: number;
    y: number;
  };
  scalingPolicy!: POLICY;
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
  scalingPolicy!: POLICY;
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
  backgroundColor: 0xc0c0c0,
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
  scoreText: new ExtendedText("0", {
    fontFamily: "Computer Modern Unicode Serif",
    fontSize: 24
  }),
  playFieldBorder: new ExtendedSprite(
    PIXI.Texture.from("assets/images/playfield.png")
  )
};

function setContainerItemProperties() {
  stageItems.playFieldBorder.optimalPositionRatio = { x: 0.33, y: 0.14 };
  stageItems.playFieldBorder.postScalingScale = { x: 0.8, y: 0.8 };
  stageItems.playFieldBorder.scalingAnchor = { x: 0.5, y: 0.5 };
  stageItems.playFieldBorder.scalingPolicy = POLICY.FullWidth;
}

setContainerItemProperties();

for (let item in stageItems) {
  stage.addChild(stageItems[item]);
}

// const renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight);
document.body.appendChild(app.view);

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
