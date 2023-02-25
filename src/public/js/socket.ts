import { variables } from "./index";
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
      renderGameData(JSON.parse(message.data));
      break;
    }
    case "changeValueOfInput": {
      $(message.selector).val(message.value);
      break;
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
function sendSocketMessage(message: any) {
  socket.send(
    JSON.stringify({
      message
    })
  );
  if (message.message === "startGame") {
    variables.playing = true;
  }
}

export { socket, sendSocketMessage };
