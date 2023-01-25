import { containerItems } from "./index";

function renderGameData(data: { [key: string]: unknown }) {
  let [centerX, centerY] = getCenterOfScreen();
  let scale: number = window.innerWidth / 1920;
  // clear screen first
  // reposition container items
  repositionContainerItems(centerX, centerY, scale);
}

function repositionContainerItems(
  centerX: number,
  centerY: number,
  scale: number
) {
  containerItems["playFieldBorder"].x = centerX - 320 * scale;
  containerItems["playFieldBorder"].y = centerY - 400 * scale;
}

function getCenterOfScreen() {
  let cx: number = window.innerWidth / 2;
  let cy: number = window.innerHeight / 2;
  return [cx, cy];
}

export { renderGameData };
