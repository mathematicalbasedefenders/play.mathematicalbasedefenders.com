import { sendSocketMessage, socket } from "./socket";

// events
function initializeKeypressEventListener() {
  window.addEventListener("keydown", (event) => {
    sendSocketMessage("keypress", [event.code]);
  });
}
export { initializeKeypressEventListener };
