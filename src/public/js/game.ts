import {
  stage,
  stageItems,
  app,
  ExtendedSprite,
  ExtendedText,
  socket
} from "./index";
import { POLICY, Size, getScaledRect } from "adaptive-scale/lib-esm";

// TODO: Might change later
const OPTIMAL_SCREEN_WIDTH: number = window.screen.width;
const OPTIMAL_SCREEN_HEIGHT: number = window.screen.height;
const OPTIMAL_SCREEN_RATIO: number =
  OPTIMAL_SCREEN_WIDTH / OPTIMAL_SCREEN_HEIGHT;

function renderGameData(data: { [key: string]: unknown }) {
  // clear screen first
  (stageItems["scoreText"] as ExtendedText).text = data[0] as string;
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

function repositionStageItems() {
  for (let item in stageItems) {
  }
}

window.onresize = () => {
  redrawStage();
};

export { renderGameData };
