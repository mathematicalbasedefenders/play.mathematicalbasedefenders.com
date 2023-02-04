import { log } from "./log";
import { processKeypressForRoom } from "./Room";
// kind of a hacky way to do this...
const NUMBER_ROW_KEYS = [
  "Digit0",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "Digit9"
];
const NUMBER_PAD_KEYS = [
  "Digit0",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "Digit9"
];

function processKeypress(
  connectionID: string | undefined,
  code: string | undefined
) {
  if (typeof connectionID !== "string") {
    log.warn(
      "A keypress event that isn't associated with any socket connectionID has been fired."
    );
    return;
  }
  if (typeof code !== "string") {
    log.warn("A keypress event that isn't a string has been fired.");
    return;
  }
  processKeypressForRoom(connectionID, code);
}

export { processKeypress };
