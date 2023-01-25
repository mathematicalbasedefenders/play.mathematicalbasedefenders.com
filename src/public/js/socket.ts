import { renderGameData } from "./game";
const socket: WebSocket = new WebSocket(
  `ws${location.protocol === "https:" ? "s" : ""}://${location.hostname}${
    false ? "" : ":5000"
  }`
);
socket.addEventListener("message", (event: any) => {
  let message: any = JSON.parse(event.data);
  switch (message.message) {
    case "renderGameData": {
      renderGameData(message.arguments);
    }
  }
});
export { socket };
