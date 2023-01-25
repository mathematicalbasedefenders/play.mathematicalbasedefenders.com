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

serifFont.load();
mathFont.load();

const app = new Application({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0xc0c0c0,
  backgroundAlpha: 0,
  resizeTo: window,
  resolution: devicePixelRatio
});

const container = new Container();

const containerItems: { [key: string]: DisplayObject } = {
  scoreText: new Text("0", {
    fontFamily: "Computer Modern Unicode Serif",
    fontSize: 24
  }),
  playFieldBorder: new Sprite(Texture.from("assets/images/playfield.png"))
};

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

export { socket, containerItems };
