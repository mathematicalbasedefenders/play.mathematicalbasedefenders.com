import FontFaceObserver from "fontfaceobserver";
import {
  Application,
  DisplayObject,
  Text,
  Container,
  Sprite,
  Texture
} from "pixi.js";
import { socket } from "./socket";
import { renderGameData } from "./game";
let startInitTime: number = Date.now();

// Fonts
const serifFont = new FontFaceObserver("Computer Modern Unicode Serif");
const mathFont = new FontFaceObserver("Computer Modern Math Italic");

class OptimallyPositionedSprite extends Sprite {
  optimalXPositionRatio!: number;
  optimalYPositionRatio!: number;
}

class OptimallyPositionedText extends Text {
  optimalXPositionRatio!: number;
  optimalYPositionRatio!: number;
}

serifFont.load();
mathFont.load();

const app = new Application({
  width: window.screen.width,
  height: window.screen.height,
  backgroundColor: 0xc0c0c0,
  backgroundAlpha: 0,
  resizeTo: window,
  resolution: devicePixelRatio
});

const container = new Container();

const containerItems: {
  [key: string]: OptimallyPositionedSprite | OptimallyPositionedText;
} = {
  tester: new OptimallyPositionedSprite(Texture.WHITE),

  scoreText: new OptimallyPositionedText("0", {
    fontFamily: "Computer Modern Unicode Serif",
    fontSize: 24
  }),
  playFieldBorder: new OptimallyPositionedSprite(
    Texture.from("assets/images/playfield.png")
  )
};

function setContainerItemPositions() {
  containerItems.playFieldBorder.optimalXPositionRatio = 0.33;
  containerItems.playFieldBorder.optimalYPositionRatio = 0.14583;
  containerItems.tester.width = 800;
  containerItems.tester.height = 500;
  containerItems.tester.tint = 0xff0000;
}

setContainerItemPositions();

for (let item in containerItems) {
  container.addChild(containerItems[item]);
}

// const renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight);
app.stage.addChild(container);
document.body.appendChild(app.view);

let endInitTime: number = Date.now();

console.log(
  `Initialization completed! (Took ${Math.round(
    endInitTime - startInitTime
  )}ms)`
);

export { socket, containerItems, container };
