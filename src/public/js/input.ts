import { socket } from "./socket";

// events
function initializeKeypressEventListener() {
  window.addEventListener("keydown", (event) => {
    socket.send(
      JSON.stringify({
        action: "keypress",
        arguments: [event.code]
      })
    );
  });
}
export { initializeKeypressEventListener };
