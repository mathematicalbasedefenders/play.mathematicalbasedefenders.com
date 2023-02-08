import { socket } from "./socket";

// events
function initializeKeypressEventListener() {
  window.addEventListener("keydown", (event) => {
    socket.send(
      JSON.stringify({
        action: "keypress",
        messageArguments: [event.code]
      })
    );
  });
}
export { initializeKeypressEventListener };
