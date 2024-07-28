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
const ABORT_KEYS = ["Escape"];
const SEND_KEYS = ["Space", "Enter"];
// send websocket message keys
const WEBSOCKET_MESSAGE_SEND_KEYS = NUMBER_ROW_KEYS.concat(
  NUMBER_PAD_KEYS,
  REMOVE_DIGIT_KEYS,
  SUBTRACTION_SIGN_KEYS,
  ABORT_KEYS,
  SEND_KEYS
);
// ignore send websocket elements
const ELEMENTS_TO_NOT_SEND_WEBSOCKET_MESSAGE = [
  "#settings-screen__content--online__username",
  "#settings-screen__content--online__password",
  "#custom-singleplayer-game__combo-time",
  "#custom-singleplayer-game__enemy-spawn-time",
  "#custom-singleplayer-game__enemy-spawn-chance",
  "#custom-singleplayer-game__forced-enemy-spawn-time",
  "#custom-singleplayer-game__enemy-speed-coefficient",
  "#custom-singleplayer-game__starting-base-health"
];

// events
function initializeKeypressEventListener() {
  window.addEventListener("keydown", (event) => {
    let sendWebSocketMessage = true;
    // other client-side events start
    if (event.code === "Tab") {
      event.preventDefault();
      $("#status-tray-container").toggle(0);
      sendWebSocketMessage = false;
    }
    if (ARROW_KEYS.indexOf(event.code) > -1) {
      event.preventDefault();
      navigateFocus(event.code);
      sendWebSocketMessage = false;
    }
    if (!WEBSOCKET_MESSAGE_SEND_KEYS.includes(event.code)) {
      sendWebSocketMessage = false;
    }
    const focusedElement = document.activeElement;
    if (focusedElement) {
      const focusedElementJQuery = $(focusedElement)[0];
      const focusedElementID = "#" + focusedElementJQuery.id;
      if (ELEMENTS_TO_NOT_SEND_WEBSOCKET_MESSAGE.includes(focusedElementID)) {
        sendWebSocketMessage = false;
      }
    }
    if (!variables.serverReportsPlaying) {
      sendWebSocketMessage = false;
    }
    // see if a websocket message should be sent
    if (!sendWebSocketMessage) {
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
