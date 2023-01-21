// @ts-nocheck

let startInitTime: number = Date.now();

// Fonts
const serifFont = new FontFaceObserver("Computer Modern Unicode Serif");
const mathFont = new FontFaceObserver("Computer Modern Math Italic");

serifFont.load();
mathFont.load();

const socket: unknown = new WebSocket(
  `ws${location.protocol === "https:" ? "s" : ""}://${location.hostname}${
    false ? "" : ":5000"
  }`
);

const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0xc0c0c0,
  backgroundAlpha: 0,
  resizeTo: window,
  resolution: devicePixelRatio
});

const container = new PIXI.Container();

const containerItems = {
  scoreText: new PIXI.Text("0", {
    fontFamily: "Computer Modern Unicode Serif",
    fontSize: 24
  })
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
