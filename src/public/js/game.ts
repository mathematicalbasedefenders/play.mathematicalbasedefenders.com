import { container, containerItems } from "./index";

// TODO: Might change later
const OPTIMAL_SCREEN_WIDTH: number = window.screen.width;
const OPTIMAL_SCREEN_HEIGHT: number = window.screen.height;
const OPTIMAL_SCREEN_RATIO: number =
  OPTIMAL_SCREEN_WIDTH / OPTIMAL_SCREEN_HEIGHT;
function renderGameData(data: { [key: string]: unknown }) {
  // clear screen first
}

function getOptimalContainerScale() {
  return Math.min(
    window.innerWidth / OPTIMAL_SCREEN_WIDTH,
    (window.screen.availHeight - (window.outerHeight - window.innerHeight)) /
      OPTIMAL_SCREEN_HEIGHT
  );
}

function rescaleContainer(scale: number) {
  container.scale.x = scale;
  container.scale.y = scale;
}

function repositionContainer(centerX: number, centerY: number) {
  // container.x = (centerX * 2 - container.width) / 2;
  container.y = (centerY * 2 - container.height) / 2;
}

function repositionContainerItems(
  windowCenterX: number,
  windowCenterY: number,
  scale: number
) {
  console.debug(
    `Container start x: ${container.x}, end x: ${
      container.x + container.width
    }`,
    `Container start y: ${container.y}, end y: ${
      container.y + container.height
    }`
  );
  for (let item in containerItems) {
    if (item === "tester") {
      containerItems[item].x = container.x;
      containerItems[item].y = container.y;
      containerItems[item].width = container.width;
      containerItems[item].height = container.height;
      return;
    }
    containerItems[item].x =
      container.width -
      containerItems[item].width +
      window.innerWidth *
        (containerItems[item].optimalXPositionRatio || 0) *
        scale;
    containerItems[item].y =
      container.height -
      containerItems[item].height +
      window.innerHeight *
        (containerItems[item].optimalYPositionRatio || 0) *
        scale;
    containerItems[item].scale.x = scale;
    containerItems[item].scale.y = scale;
  }
}

function getCenterOfWindow() {
  let cx: number = window.innerWidth / 2;
  let cy: number = window.innerHeight / 2;
  return [cx, cy];
}

window.onresize = () => {
  let [windowCenterX, windowCenterY] = getCenterOfWindow();
  let scale: number = getOptimalContainerScale();
  // // reposition container
  // rescaleContainer(scale);
  // // reposition container
  // repositionContainer(windowCenterX, windowCenterY);

  let newWidth: number, newHeight: number;
  if (window.innerWidth / window.innerHeight >= OPTIMAL_SCREEN_RATIO) {
    newWidth = window.innerHeight * OPTIMAL_SCREEN_RATIO;
    newHeight = window.innerHeight;
  } else {
    newWidth = window.innerWidth;
    newHeight = window.innerWidth / OPTIMAL_SCREEN_RATIO;
  }
  container.width = newWidth;
  container.height = newHeight;
  repositionContainer(windowCenterX, windowCenterY);
  // reposition container items
  repositionContainerItems(windowCenterX, windowCenterY, scale);
};

export { renderGameData };
