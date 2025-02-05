import {
  updateGuestInformationText,
  updateUserInformationText,
  variables
} from "./index";
import { updateStatusTrayText } from "./status-tray";
import { changeScreen, renderGameData } from "./game";
import { ToastNotification } from "./toast-notification";
import { updateSystemStatusTrayText } from "./system-status-indicator";
import { createChatMessage } from "./chat";
import DOMPurify from "dompurify";
const socket: WebSocket = new WebSocket(
  `ws${location.protocol === "https:" ? "s" : ""}://${location.hostname}${
    window.location.origin === "https://play.mathematicalbasedefenders.com"
      ? ""
      : ":5000"
  }`
);
socket.addEventListener("close", (event: any) => {
  alert("Lost connection to server.");
  location.reload();
});
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
      const notification = new ToastNotification(message.text, message.options);
      notification.render();
      break;
    }
    case "updateUserInformationText": {
      updateUserInformationText(message.data);
      break;
    }
    case "updateServerMetadata": {
      updateStatusTrayText(message.data);
      updateSystemStatusTrayText(message.data);
      break;
    }
    case "updateSocketMetadata": {
      variables.serverReportsPlaying = message.data.playing;
      variables.serverReportsInMultiplayer = message.data.inMultiplayerRoom;
      break;
    }
    case "addChatMessage": {
      const sanitizedMessage = message.data.message;
      sanitizedMessage.sender = DOMPurify.sanitize(sanitizedMessage.sender);
      sanitizedMessage.message = DOMPurify.sanitize(sanitizedMessage.message);
      const sanitizedSender = DOMPurify.sanitize(message.data.sender);
      const sanitizedSenderColor = DOMPurify.sanitize(message.data.senderColor);
      const sanitizedAttribute = DOMPurify.sanitize(message.data.attribute);
      const chatMessage = createChatMessage(
        sanitizedMessage,
        sanitizedSenderColor,
        sanitizedAttribute
      );
      $(message.data.location).prepend(chatMessage);
      break;
    }
    case "exitOpeningScreen": {
      if (!variables.isAuthenticated && !variables.isGuest) {
        // TODO: Redo ToastNotification parameters
        const ERROR_NOTIFICATION_OPTIONS = { backgroundColor: "#ff0000" };
        new ToastNotification(
          `Unauthorized attempt to exit opening screen.`,
          ERROR_NOTIFICATION_OPTIONS
        );
        console.error("Unauthorized attempt to exit opening screen.");
        return;
      }
      $("#opening-screen-container").hide(0);
      sendSocketMessage({ message: "exitOpeningScreen" });
      variables.exitedOpeningScreen = true;
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
