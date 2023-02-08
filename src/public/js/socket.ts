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
      renderGameData(JSON.parse(message.messageArguments[0]));
    }
  }
});
function sendMessage(message: string, messageArguments: string) {
  socket.send(
    JSON.stringify({
      message: message,
      messageArguments: messageArguments
    })
  );
}
export { socket };
