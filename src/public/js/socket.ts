import { updateGuestInformationText, variables } from "./index";
import { renderGameData } from "./game";
const socket: WebSocket = new WebSocket(
  `ws${location.protocol === "https:" ? "s" : ""}://${location.hostname}${
    window.location.origin === "https://play.mathematicalbasedefenders.com"
      ? ""
      : ":5000"
  }`
);
socket.addEventListener("message", (event: any) => {
  let message: any = JSON.parse(event.data);
  if (
    event.origin !== "wss://play.mathematicalbasedefenders.com:5000" &&
    event.origin !== "wss://play.mathematicalbasedefenders.com" &&
    event.origin !== "ws://localhost:5000"
  ) {
    console.error(`Unknown socket message origin: ${event.origin}`);
    return;
  }
  switch (message.message) {
    case "renderGameData": {
      renderGameData(JSON.parse(message.data));
      break;
    }
    case "changeValueOfInput": {
      $(message.selector).val(message.value);
      break;
    }
    case "updateGuestInformationText": {
      updateGuestInformationText(message.data);
    }
    case "changeText": {
      $(message.selector).text(message.value);
      break;
    }
    case "changeCSS": {
      $(message.selector).css(message.key, message.value);
      break;
    }
  }
});
function sendSocketMessage(message: { [key: string]: string }) {
  socket.send(
    JSON.stringify({
      message
    })
  );
  // Post send client actions
  if (message.message === "startGame") {
    variables.playing = true;
  }
}

export { socket, sendSocketMessage };
