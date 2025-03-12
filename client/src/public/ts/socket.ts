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
import { showUserLookupPopUp } from "./lookup-user";
import { checkPlayerListCacheEquality, millisecondsToTime } from "./utilities";
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
      sanitizedMessage.userID = DOMPurify.sanitize(sanitizedMessage.userID);
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
      changeScreen("mainMenu");
      sendSocketMessage({ message: "exitOpeningScreen" });
      variables.exitedOpeningScreen = true;
      break;
    }
    case "modifyPlayerListContent": {
      // check cache first...
      const prefix = "player-lookup-on-click-";
      const suffix = "--player-list";

      if (
        checkPlayerListCacheEquality(
          variables.multiplayerChat.playerListCache,
          message.data,
          prefix,
          suffix
        )
      ) {
        return;
      }

      // if cache doesn't match, redo html

      // clear cache
      variables.multiplayerChat.playerListCache.playerCount = 0;
      variables.multiplayerChat.playerListCache.registeredPlayers.clear();

      const playerListSelector =
        "#main-content__multiplayer-intermission-screen-container__chat__player-list";
      $(playerListSelector).empty();
      for (const player of message.data) {
        const entry = $("<div></div>");
        const id = `player-lookup-on-click-${player.userID}--player-list`;
        entry.text(player.name);
        entry.css("color", player.color);
        // add get data-able for player
        if (player.isRegistered) {
          entry.attr("id", id);
          entry.css("text-decoration", "underline");
          entry.css("cursor", "pointer");
          variables.multiplayerChat.playerListCache.registeredPlayers.add(id);
        }
        $(playerListSelector).append(entry);
        variables.multiplayerChat.playerListCache.playerCount++;
      }
      // add click event
      $("[id^=player-lookup-on-click][id$=--player-list]").each(function () {
        const substringStart = "player-lookup-on-click-".length;
        let targetUserID = $(this).attr("id") as string;
        targetUserID = targetUserID.substring(
          substringStart,
          substringStart + 24
        );
        $(this).on("click", function () {
          showUserLookupPopUp(targetUserID);
        });
      });
      break;
    }
    case "modifyMultiplayerRankContent": {
      // check cache first...
      const prefix = "player-lookup-on-click-";
      const suffix = "--last-game-rank-list";
      if (
        checkPlayerListCacheEquality(
          variables.multiplayerLastGameRankings.playerListCache,
          message.data,
          prefix,
          suffix
        )
      ) {
        return;
      }

      // if cache doesn't match, redo html

      // clear cache
      variables.multiplayerLastGameRankings.playerListCache.playerCount = 0;
      variables.multiplayerLastGameRankings.playerListCache.registeredPlayers.clear();

      const selector =
        "#main-content__multiplayer-intermission-screen-container__game-status-ranking";
      $(selector).empty();
      const placements = message.data;
      for (const placement of placements) {
        const entry = $("<div></div>");
        entry.addClass("ranking-placement");
        //
        const entryLeft = $("<div></div>");
        entryLeft.addClass("ranking-placement--left");
        entryLeft.append(`<div>#${placement.placement}</div>`);
        entryLeft.append(`&nbsp;`);
        //
        const entryName = $("<div></div>");
        const idName = `player-lookup-on-click-${placement.userID}--last-game-rank-list`;
        entryName.text(placement.name);
        entryName.css("color", placement.nameColor);
        // add get data-able for player
        if (placement.isRegistered) {
          entryName.attr("id", idName);
          entryName.css("text-decoration", "underline");
          entryName.css("cursor", "pointer");
          variables.multiplayerLastGameRankings.playerListCache.registeredPlayers.add(
            idName
          );
        }
        entryLeft.append(entryName);
        variables.multiplayerLastGameRankings.playerListCache.playerCount++;
        //
        const entryRight = $("<div></div>");
        entryRight.addClass("ranking-placement--right");
        const time = millisecondsToTime(Number.parseInt(placement.time));
        entryRight.append(
          `<div>+${placement.sent} -${placement.received} ${time}</div>`
        );
        //
        entry.append(entryLeft);
        entry.append(entryRight);
        $(selector).append(entry);
      }
      // add click event
      $("[id^=player-lookup-on-click][id$=--last-game-rank-list]").each(
        function () {
          const substringStart = "player-lookup-on-click-".length;
          let targetUserID = $(this).attr("id") as string;
          targetUserID = targetUserID.substring(
            substringStart,
            substringStart + 24
          );
          $(this).on("click", function () {
            showUserLookupPopUp(targetUserID);
          });
        }
      );
      break;
    }
    case "addRoomChatMessage": {
      const selector =
        "#main-content__multiplayer-intermission-screen-container__chat__messages";

      const chatMessage = $("<div></div>");
      chatMessage.css("display", "flex");
      chatMessage.css("white-space", "pre");

      const name = $(`<div>${DOMPurify.sanitize(message.data.name)}</div>`);

      if (message.data.nameColor) {
        name.css("color", message.data.nameColor);
      }

      if (message.data.userID) {
        name.on("click", function () {
          showUserLookupPopUp(message.data.userID);
        });
        name.css("cursor", "pointer");
        name.css("text-decoration", "underline");
      }

      chatMessage.append(name);
      chatMessage.append("<div>: </div>");
      chatMessage.append(
        `<div>${DOMPurify.sanitize(message.data.message)}</div>`
      );

      $(selector).append(chatMessage);
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
