import {
  updateGuestInformationText,
  updateUserInformationText,
  variables
} from "./index";
import { changeScreen, renderGameData } from "./game";
import { ToastNotification } from "./notifications";
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
  // update origin
  $("#current-domain").text(window.location.origin);
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
    case "changeHTML": {
      $(message.selector).html(message.value);
      break;
    }
    case "appendHTML": {
      $(message.selector).append(message.value);
      break;
    }
    case "changeScreen": {
      changeScreen(message.newScreen, true, true);
      break;
    }
    case "createToastNotification": {
      new ToastNotification(message.text, message.position);
      break;
    }
    case "updateUserInformationText": {
      updateUserInformationText(message.data);
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
