import DOMPurify from "dompurify";
import { showUserLookupPopUp } from "./lookup-user";

interface GlobalChatMessage {
  name?: string;
  mode?: string;
  score?: number;
  rank?: number;
  timeElapsed?: number;
  apm?: number;
  enemiesKilled?: number;
  enemiesSpawned?: number;
  sender: string;
  message: string;
  senderUserID: string;
}

/**
 * Creates a chat message for the global(?) chat tray.
 * @param {GlobalChatMessage} message The data of the message. This is not limited to the content of the message.
 * @param {string} nameColor The color to color the sender's name of the message with.
 * @param {string} attribute The message's type.
 * @returns A jQuery element (to be appended to the chat box)
 */
function createChatMessage(
  message: GlobalChatMessage,
  nameColor: string,
  attribute?: string
) {
  const data = message;
  switch (attribute) {
    case "leaderboards": {
      return createLeaderboardsChatMessage(data, nameColor);
    }
    default: {
      return createDefaultChatMessage(data, nameColor);
    }
  }
}

/**
 * Changes an internal mode name to a human-readable mode name.
 * @param {string} mode The internal mode name
 * @returns The human-readable mode name.
 */
function getMode(mode: string) {
  switch (mode) {
    case "easySingleplayer": {
      return "Easy Singleplayer";
    }
    case "standardSingleplayer": {
      return "Standard Singleplayer";
    }
    default: {
      return "(Unknown Mode)";
    }
  }
}

/**
 * Creates a "leaderboard announcement"-styled chat message for global chat.
 * @param {GlobalChatMessage} data The data for the chat message. Should contain game data.
 * @param {string} nameColor The color to use for the sender's name. `#ffffff` if not supplied.
 * @returns A jQuery element (to be appended to the chat box)
 */
function createLeaderboardsChatMessage(
  data: GlobalChatMessage,
  nameColor?: string
) {
  // fix broken data
  if (!data.score) {
    data.score = 0;
  }

  if (!nameColor) {
    nameColor = "#ffffff";
  }

  // create element
  const CLASS_NAMES = ["chat-tray__message", "chat-tray__message--alert-score"];
  const element = $("<div></div>");
  element.addClass(CLASS_NAMES);
  // create top part
  const topDiv = $(`<div></div>`);
  topDiv.addClass("chat-tray__message-alert-score__top");
  // create name for top part
  const nameElement = $(`<span>${DOMPurify.sanitize(data.sender)}</span>`);
  nameElement.css("color", nameColor);
  // combine name to top part
  topDiv.append(nameElement);
  // add mode to top part
  topDiv.append(`<div>${getMode(data.mode as string)}</div>`);
  // create middle part
  const middleDiv = $(`<div></div>`);
  middleDiv.addClass("chat-tray__message-alert-score__middle");
  middleDiv.text(`${DOMPurify.sanitize(data.score.toLocaleString("en-US"))}`);
  // create bottom part
  const bottomDiv = $(`<div></div>`);
  bottomDiv.addClass("chat-tray__message-alert-score__bottom");
  bottomDiv.append(`#${DOMPurify.sanitize(data.rank?.toString() || "0")}, `);
  bottomDiv.append(
    `${DOMPurify.sanitize(data.timeElapsed?.toString() || "0")}ms, `
  );
  bottomDiv.append(`${DOMPurify.sanitize(data.apm?.toString() || "0")}APM, `);
  bottomDiv.append(
    `${DOMPurify.sanitize(data.enemiesKilled?.toString() || "0")}`
  );
  bottomDiv.append(`/`);
  bottomDiv.append(
    `${DOMPurify.sanitize(data.enemiesSpawned?.toString() || "0")}`
  );
  // construct element
  element.append(topDiv);
  element.append(middleDiv);
  element.append(bottomDiv);
  return element;
}

/**
 * Creates a regular "default" chat message for global chat.
 * @param {GlobalChatMessage} data The data of the chat message. Contains sender and message.
 * @param {string} nameColor The color to use for the sender's name. `#ffffff` if not supplied.
 * @returns A jQuery element (to be appended to the chat box)
 */
function createDefaultChatMessage(data: GlobalChatMessage, nameColor?: string) {
  // fix broken data
  if (!nameColor) {
    nameColor = "#ffffff";
  }

  const CLASS_NAME = "chat-tray__message";
  const element = $("<div></div>");
  element.addClass(CLASS_NAME);

  // const clickEvent = data`showUserLookupPopUp(${})`

  const nameElement = $(`<span>${DOMPurify.sanitize(data.sender)}</span>`);
  nameElement.css("color", nameColor);

  if (data.senderUserID) {
    nameElement.on("click", function () {
      showUserLookupPopUp(data.senderUserID);
    });
    nameElement.css("text-decoration", "underline");
    nameElement.css("cursor", "pointer");
  }

  element.append(nameElement);
  element.append(`: ${DOMPurify.sanitize(data.message)}`);
  return element;
}

export { createChatMessage };
