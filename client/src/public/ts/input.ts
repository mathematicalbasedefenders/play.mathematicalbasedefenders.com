import { navigateFocus } from "./arrow-key-navigation";
import { variables } from "./index";
import { sendSocketMessage, socket } from "./socket";
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
  "Numpad0",
  "Numpad1",
  "Numpad2",
  "Numpad3",
  "Numpad4",
  "Numpad5",
  "Numpad6",
  "Numpad7",
  "Numpad8",
  "Numpad9"
];
const REMOVE_DIGIT_KEYS = ["NumpadAdd", "Backspace"];
const SUBTRACTION_SIGN_KEYS = ["Minus", "NumpadSubtract"];
const ARROW_KEYS = ["ArrowLeft", "ArrowUp", "ArrowDown", "ArrowRight"];
// events
function initializeKeypressEventListener() {
  window.addEventListener("keydown", (event) => {
    // other client-side events start
    if (event.code === "Tab") {
      event.preventDefault();
      $("#status-tray-container").toggle(0);
      return;
    }
    if (ARROW_KEYS.indexOf(event.code) > -1) {
      event.preventDefault();
      navigateFocus(event.code);
      return;
    }
    // main client-side events start
    sendSocketMessage({
      message: "keypress",
      keypress: event.code
    });
    // also take care of client-side.
    const numberRowKeyIndex = NUMBER_ROW_KEYS.indexOf(event.code);
    const numberPadKeyIndex = NUMBER_PAD_KEYS.indexOf(event.code);
    const removeDigitKeyIndex = REMOVE_DIGIT_KEYS.indexOf(event.code);
    const subtractionSignKeyIndex = SUBTRACTION_SIGN_KEYS.indexOf(event.code);
    if (numberRowKeyIndex > -1) {
      variables.currentGameClientSide.currentInput +=
        numberRowKeyIndex.toString();
    } else if (numberPadKeyIndex > -1) {
      variables.currentGameClientSide.currentInput +=
        numberPadKeyIndex.toString();
    } else if (subtractionSignKeyIndex > -1) {
      variables.currentGameClientSide.currentInput += "-";
    } else if (removeDigitKeyIndex > -1) {
      const newLength = variables.currentGameClientSide.currentInput.length - 1;
      variables.currentGameClientSide.currentInput =
        variables.currentGameClientSide.currentInput.substring(0, newLength);
    }
    // main client-side events end
  });
}
export { initializeKeypressEventListener };
