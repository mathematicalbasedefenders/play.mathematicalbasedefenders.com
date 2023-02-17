import { sendSocketMessage, socket } from "./socket";

// events
function initializeKeypressEventListener() {
  window.addEventListener("keydown", (event) => {
    sendSocketMessage({
      message: "keypress",
      keypress: event.code
    });
  });
}
export { initializeKeypressEventListener };
