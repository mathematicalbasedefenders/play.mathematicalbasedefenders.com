import _ from "lodash";
import { variables } from ".";
import { PopupNotification } from "./popup-notification";

// Usually it's left/right/up/down, but sometimes there may be other keys required
// for the `DirectionMap`.
interface DirectionMap {
  [key: string]: string;
}

interface DestinationMap {
  destinations: {
    [key: string]: DirectionMap;
  };
  defaultFocused?: string;
}

// Globals
const settingsSecondaryScreenOrder: { [key: string]: Array<string> } = {
  "online": [
    //   "#settings-screen__content--online__username",
    //   "#settings-screen__content--online__password",
    //   "#settings-screen__content--online__submit"
  ],
  "video": [
    "#settings-multiplication-sign__times",
    "#settings-multiplication-sign__middle-dot",
    "#settings-beautiful-score-display__on",
    "#settings-beautiful-score-display__off",
    "#settings-enemy-color__random-for-each",
    "#settings-enemy-color__random-for-each-from-palette",
    "#settings-enemy-color__set-color",
    "#settings-enemy-size__single-width",
    "#settings-enemy-size__double-width",
    "#settings-enemy-scale__100-scale",
    "#settings-enemy-scale__110-scale",
    "#settings-enemy-scale__125-scale",
    "#settings-enemy-scale__150-scale",
    "#settings-enemy-scale__200-scale",
    "#settings-score-display__on",
    "#settings-score-display__off",
    "#settings-level-display__low",
    "#settings-level-display__medium",
    "#settings-level-display__high",
    "#settings-flash-input-area-on-enemy-kill__on",
    "#settings-flash-input-area-on-enemy-kill__off",
    "#settings-force-hide-tutorial-text__on",
    "#settings-force-hide-tutorial-text__off",
    "#settings__background-image-url",
    "#settings-screen__content-save-background-image"
  ],
  "audio": ["#settings-sound__on", "#settings-sound__off"]
};
const customSingleplayerIntermissionSecondaryScreenOrder: {
  [key: string]: Array<string>;
} = {
  "global": [
    "#custom-singleplayer-intermission-screen-container__start-button",
    "#custom-singleplayer-game__combo-time"
  ],
  "enemies": [
    "#custom-singleplayer-game__enemy-spawn-time",
    "#custom-singleplayer-game__enemy-spawn-chance",
    "#custom-singleplayer-game__forced-enemy-spawn-time",
    "#custom-singleplayer-game__enemy-speed-coefficient"
  ],
  "base": ["#custom-singleplayer-game__starting-base-health"]
};

/**
 * New destination: directions.(currentScreen).destinations.(currentElement).(keyPressed)
 */
function getArrowKeyDirections() {
  const directions: { [key: string]: DestinationMap } = {
    "mainMenu": {
      destinations: {
        "#main-menu-screen-button--singleplayer": {
          "ArrowDown": "#main-menu-screen-button--multiplayer"
        },
        "#main-menu-screen-button--multiplayer": {
          "ArrowUp": "#main-menu-screen-button--singleplayer",
          "ArrowDown": "#main-menu-screen-button--archive"
        },
        "#main-menu-screen-button--archive": {
          "ArrowUp": "#main-menu-screen-button--multiplayer",
          "ArrowRight": "#main-menu-screen-button--settings",
          "ArrowDown": "#main-menu-screen-button--settings"
        },
        "#main-menu-screen-button--settings": {
          "ArrowUp": "#main-menu-screen-button--multiplayer",
          "ArrowLeft": "#main-menu-screen-button--archive"
        }
      },
      defaultFocused: "#main-menu-screen-button--singleplayer"
    },
    "singleplayerMenu": {
      destinations: {
        "#singleplayer-menu-screen-button--standard": {
          "ArrowDown": "#singleplayer-menu-screen-button--easy"
        },
        "#singleplayer-menu-screen-button--easy": {
          "ArrowUp": "#singleplayer-menu-screen-button--standard",
          "ArrowRight": "#singleplayer-menu-screen-button--custom",
          "ArrowDown": "#singleplayer-menu-screen-button--back"
        },
        "#singleplayer-menu-screen-button--custom": {
          "ArrowUp": "#singleplayer-menu-screen-button--standard",
          "ArrowLeft": "#singleplayer-menu-screen-button--easy",
          "ArrowDown": "#singleplayer-menu-screen-button--back"
        },
        "#singleplayer-menu-screen-button--back": {
          "ArrowUp": "#singleplayer-menu-screen-button--easy"
        }
      },
      defaultFocused: "#singleplayer-menu-screen-button--standard"
    },
    "multiplayerMenu": {
      destinations: {
        "#multiplayer-menu-screen-button--default": {
          "ArrowDown": "#multiplayer-menu-screen-button--custom"
        },
        "#multiplayer-menu-screen-button--custom": {
          "ArrowUp": "#multiplayer-menu-screen-button--default",
          "ArrowDown": "#multiplayer-menu-screen-button--back"
        },
        "#multiplayer-menu-screen-button--back": {
          "ArrowUp": "#multiplayer-menu-screen-button--custom"
        }
      },
      defaultFocused: "#multiplayer-menu-screen-button--default"
    },
    "customMultiplayerRoomSelection": {
      destinations: {
        "#custom-multiplayer-room-selection-screen-button--join": {
          "ArrowDown":
            "#custom-multiplayer-room-selection-screen-button--create"
        },
        "#custom-multiplayer-room-selection-screen-button--create": {
          "ArrowUp": "#custom-multiplayer-room-selection-screen-button--join",
          "ArrowDown": "#custom-multiplayer-room-selection-screen-button--back"
        },
        "#custom-multiplayer-room-selection-screen-button--back": {
          "ArrowUp": "#custom-multiplayer-room-selection-screen-button--create"
        }
      },
      defaultFocused: "#custom-multiplayer-room-selection-screen-button--join"
    },
    "customSingleplayerIntermission": getCustomSingleplayerMenuDestinations(
      variables.navigation.currentSecondaryScreen
    ),
    "settingsMenu": getSettingsMenuDestinations(
      variables.navigation.currentSecondaryScreen
    ),
    "gameOver": {
      destinations: {
        "#game-over-screen-button--retry": {
          "ArrowRight": "#game-over-screen-button--back"
        },
        "#game-over-screen-button--back": {
          "ArrowLeft": "#game-over-screen-button--retry"
        }
      },
      defaultFocused: "#game-over-screen-button--retry"
    },
    "multiplayerIntermission": {
      destinations: {
        "#multiplayer-screen__sidebar-item--back": {
          "ArrowDown": "#chat-message"
        },
        "#chat-message": {
          "ArrowLeft": "#multiplayer-screen__sidebar-item--back",
          "ArrowUp": "#multiplayer-screen__sidebar-item--back",
          "ArrowRight": "#message-send-button",
          "ArrowDown":
            "#main-content__multiplayer-intermission-screen-container__player-list__toggle-list"
        },
        "#message-send-button": {
          "ArrowUp": "#multiplayer-screen__sidebar-item--back",
          "ArrowLeft": "#chat-message",
          "ArrowDown":
            "#main-content__multiplayer-intermission-screen-container__player-list__toggle-list"
        },
        "#main-content__multiplayer-intermission-screen-container__player-list__toggle-list":
          {
            "ArrowUp": "#chat-message"
          }
      },
      defaultFocused: "#chat-message"
    },
    "customMultiplayerIntermission": {
      destinations: {
        "#custom-multiplayer-screen__sidebar-item--back": {
          "ArrowDown": "#custom-multiplayer-room-indicator-label__copy"
        },
        "#custom-multiplayer-room-indicator-label__copy": {
          "ArrowUp": "#custom-multiplayer-screen__sidebar-item--back",
          "ArrowRight":
            "#custom-multiplayer-room-indicator-label__toggle-visibility",
          "ArrowDown":
            "#custom-multiplayer-room-indicator-label__toggle-visibility"
        },
        "#custom-multiplayer-room-indicator-label__toggle-visibility": {
          "ArrowUp": "#custom-multiplayer-room-indicator-label__copy",
          "ArrowLeft": "#custom-multiplayer-room-indicator-label__copy",
          "ArrowRight": "#custom-multiplayer-chat-message",
          "ArrowDown": "#custom-multiplayer-chat-message"
        },
        "#custom-multiplayer-chat-message": {
          "ArrowLeft":
            "#custom-multiplayer-room-indicator-label__toggle-visibility",
          "ArrowUp":
            "#custom-multiplayer-room-indicator-label__toggle-visibility",
          "ArrowRight": "#custom-multiplayer-message-send-button",
          "ArrowDown":
            "#main-content__custom-multiplayer-intermission-screen-container__player-list__toggle-list"
        },
        "#custom-multiplayer-message-send-button": {
          "ArrowUp": "#custom-multiplayer-screen__sidebar-item--back",
          "ArrowLeft": "#custom-multiplayer-chat-message",
          "ArrowDown":
            "#main-content__custom-multiplayer-intermission-screen-container__player-list__toggle-list"
        },
        "#main-content__custom-multiplayer-intermission-screen-container__player-list__toggle-list":
          {
            "ArrowUp": "#custom-multiplayer-chat-message"
          }
      },
      defaultFocused: "#custom-multiplayer-chat-message"
    },
    "globalChatTray": getGlobalChatTrayDirections(),
    "openingScreen": getOpeningScreenDirections(),
    "canvas": { destinations: {} },
    "archiveMenu": {
      destinations: {
        "#archive-screen-container__back-button": {
          "ArrowRight": "#archive__replay-id"
        },
        "#archive__replay-id": {
          "ArrowLeft": "#archive-screen-container__back-button",
          "ArrowDown": "#archive__search-button"
        },
        "#archive__search-button": {
          "ArrowLeft": "#archive__replay-id",
          "ArrowUp": "#archive__replay-id",
          "ArrowDown": $("#archive__start-button").is(":visible")
            ? "#archive__start-button"
            : "#archive__search-button"
        },
        "#archive__start-button": {
          "ArrowUp": "#archive__search-button",
          "ArrowLeft": "#archive-screen-container__back-button"
        }
      },
      defaultFocused: "#archive-screen-container__back-button"
    }
  };
  return directions;
}

function getSettingsMenuDestinations(secondaryScreen: string) {
  const result: DestinationMap = {
    destinations: {
      "#settings-screen__sidebar-item--back": {
        "ArrowDown": "#settings-screen__sidebar-item--online"
      },
      "#settings-screen__sidebar-item--online": {
        "ArrowUp": "#settings-screen__sidebar-item--back",
        "ArrowDown": "#settings-screen__sidebar-item--video"
      },
      "#settings-screen__sidebar-item--video": {
        "ArrowUp": "#settings-screen__sidebar-item--online",
        "ArrowDown": "#settings-screen__sidebar-item--audio"
      },
      "#settings-screen__sidebar-item--audio": {
        "ArrowUp": "#settings-screen__sidebar-item--video"
      }
    },
    defaultFocused: "#settings-screen__sidebar-item--back"
  };
  if (["online", "video", "audio"].indexOf(secondaryScreen) === -1) {
    return result;
  }
  // add `ArrowRight` action
  for (const key of Object.keys(result.destinations)) {
    result.destinations[key]["ArrowRight"] =
      settingsSecondaryScreenOrder[secondaryScreen][0];
  }
  // merge with function
  _.merge(
    result.destinations,
    constructUpDownKeyDirections(settingsSecondaryScreenOrder[secondaryScreen])
  );
  // merge with extras
  _.merge(result.destinations, {
    "#settings-enemy-color__random-for-each-from-palette": {
      "ArrowRight": "#selected-enemy-color-palette"
    },
    "#settings-enemy-color__set-color": {
      "ArrowRight": "#settings__enemy-color__forced-color-picker"
    },
    "#selected-enemy-color-palette": {
      "ArrowLeft": "#settings-enemy-color__random-for-each-from-palette"
    },
    "#settings__enemy-color__forced-color-picker": {
      "ArrowLeft": "#settings-enemy-color__set-color"
    }
  });
  // add `ArrowLeft` action
  for (const key of settingsSecondaryScreenOrder[secondaryScreen]) {
    result.destinations[key]["ArrowLeft"] =
      "#settings-screen__sidebar-item--back";
  }
  return result;
}

function getCustomSingleplayerMenuDestinations(secondaryScreen: string) {
  const result: DestinationMap = {
    destinations: {
      "#custom-singleplayer-intermission-screen-container__back-button": {
        "ArrowDown":
          "#custom-singleplayer-intermission-screen-container__global-button"
      },
      "#custom-singleplayer-intermission-screen-container__global-button": {
        "ArrowUp":
          "#custom-singleplayer-intermission-screen-container__back-button",
        "ArrowDown":
          "#custom-singleplayer-intermission-screen-container__enemies-button"
      },
      "#custom-singleplayer-intermission-screen-container__enemies-button": {
        "ArrowUp":
          "#custom-singleplayer-intermission-screen-container__global-button",
        "ArrowDown":
          "#custom-singleplayer-intermission-screen-container__base-button"
      },
      "#custom-singleplayer-intermission-screen-container__base-button": {
        "ArrowUp":
          "#custom-singleplayer-intermission-screen-container__enemies-button"
      }
    },
    defaultFocused:
      "#custom-singleplayer-intermission-screen-container__back-button"
  };
  if (["global", "enemies", "base"].indexOf(secondaryScreen) === -1) {
    return result;
  }
  // add `ArrowRight` action
  for (const key of Object.keys(result.destinations)) {
    result.destinations[key]["ArrowRight"] =
      customSingleplayerIntermissionSecondaryScreenOrder[secondaryScreen][0];
  }
  // merge with function
  _.merge(
    result.destinations,
    constructUpDownKeyDirections(
      customSingleplayerIntermissionSecondaryScreenOrder[secondaryScreen]
    )
  );
  // add `ArrowLeft` action
  for (const key of customSingleplayerIntermissionSecondaryScreenOrder[
    secondaryScreen
  ]) {
    result.destinations[key]["ArrowLeft"] =
      "#custom-singleplayer-intermission-screen-container__back-button";
  }
  return result;
}

function getGlobalChatTrayDirections() {
  const result: DestinationMap = {
    destinations: {
      "#chat-tray-input-send-button": {
        "ArrowLeft": "#chat-tray-input"
      }
    },
    defaultFocused: "#chat-tray-input"
  };
  return result;
}

function getOpeningScreenDirections() {
  const elements = [
    "#authentication-modal__username",
    "#authentication-modal__password",
    "#settings-screen__content--online__submit",
    "#opening-screen__register",
    "#opening-screen__play-as-guest"
  ];
  const result = _.merge({
    destinations: constructUpDownKeyDirections(elements)
  });
  result.defaultFocused = "#authentication-modal__username";
  return result;
}

function getMultiplayerRoomSelectionDialogDirections() {
  const destinations: { [key: string]: any } = {
    "#custom-multiplayer-room-selection-dialog__close": {
      "ArrowDown": "#room-to-join"
    },
    "#room-to-join": {
      "ArrowUp": "#custom-multiplayer-room-selection-dialog__close",
      "ArrowRight": "#join-by-code",
      "ArrowDown": "#public-room-list__refresh"
    },
    "#join-by-code": {
      "ArrowUp": "#custom-multiplayer-room-selection-dialog__close",
      "ArrowLeft": "#room-to-join",
      "ArrowRight": "#public-room-list__refresh",
      "ArrowDown": "#public-room-list__refresh"
    },
    "#public-room-list__refresh": {
      "ArrowUp": "#room-to-join",
      "ArrowRight": "#public-room-list__join",
      "ArrowDown": "#public-room-list"
    },
    "#public-room-list__join": {
      "ArrowUp": "#room-to-join",
      "ArrowLeft": "#public-room-list__refresh",
      "ArrowDown": "#public-room-list"
    },
    "#public-room-list": {
      "ArrowUp": "#public-room-list__join"
    }
  };
  return destinations;
}

/**
 * Utility function which constructs a object for easy `ArrowUp/ArrowDown` navigation.
 * @param {Array<string>} ids The ids of each element in order.
 * @returns An object where for each string,
 * ArrowUp will lead to one before it, and ArrowDown will lead to one after it.
 */
function constructUpDownKeyDirections(ids: Array<string>) {
  const result: { [key: string]: DirectionMap } = {};
  for (let i = 0; i < ids.length; i++) {
    result[ids[i]] = {};
    if (i == 0) {
      result[ids[i]]["ArrowDown"] = ids[i + 1];
      continue;
    }
    if (i == ids.length - 1) {
      result[ids[i]]["ArrowUp"] = ids[i - 1];
      continue;
    }
    result[ids[i]]["ArrowDown"] = ids[i + 1];
    result[ids[i]]["ArrowUp"] = ids[i - 1];
  }
  return result;
}

/**
 * Changes/navigates the focused element based on the current screen shown
 * (and the focused element) and the pressed key.
 * The focused element is already stored in `variables.navigation`,
 * so there is no need to pass it as a parameter.
 * @param {KeyboardEvent} event The keypress event.
 */
function navigateFocus(event: KeyboardEvent) {
  const keyPressed = event.code;
  let forcedDestination = null;
  let screen = variables.navigation.currentScreen;
  let element = variables.navigation.focusing;
  const directions = getArrowKeyDirections();
  // FORCED OVERWRITES
  // overwrite: if end of multiplayer chat tray is focused, focus on the send button instead.
  if (checkIfFocusedOnEndOfMessageBox(screen, element, keyPressed)) {
    if (screen === "multiplayerIntermission") {
      forcedDestination = "#message-send-button";
    } else if (screen === "customMultiplayerIntermission") {
      forcedDestination = "#custom-multiplayer-message-send-button";
    }
  }
  // overwrite: if chat tray is active, focus there instead.
  if ($("#chat-tray-container").is(":visible")) {
    screen = "globalChatTray";
    // overwrite: if chat tray is focused and caret is at end, move
    // to send button instead.
    if (checkIfFocusedOnEndOfChatTray(screen, element, keyPressed)) {
      forcedDestination = "#chat-tray-input-send-button";
    }
  }
  // overwrite: if focused element is an input, and caret is at leftmost,
  // move where the left arrow should be instead
  if (
    !forcedDestination &&
    $(element).is("input") &&
    checkIfChatBoxShouldForceLeftArrowMove(screen, element, keyPressed)
  ) {
    forcedDestination = directions[screen]?.defaultFocused;
  }
  // overwrite: radio buttons
  if (
    $(element).is("input[type=radio]") &&
    !forcedDestination &&
    keyPressed === "ArrowLeft"
  ) {
    event.preventDefault();
    forcedDestination = directions[screen]?.defaultFocused;
  }
  // overwrite: right buttons on input type radio no more select
  if ($(element).is("input[type=radio]") && keyPressed === "ArrowRight") {
    event.preventDefault();
  }
  // DESTRUCTIVE OVERWRITES
  if (
    PopupNotification.activeNotifications > 0 &&
    variables.exitedOpeningScreen
  ) {
    // overwrite: if there is a popup notification active, give it priority.
    // but only if the opening screen isn't gone.
    // right now, there will be only 1 pop-up notification active, which is the "Hello!" popup.
    // currently, later notifications are given priority when dealing with arrow keys.
    event.preventDefault();
    // this focuses on the most recent/top-most pop up.
    focusPopup();
    return;
  }
  // overwrite: custom multiplayer room selection room selection dialog
  // force usage of destination mapping for dialog
  if (
    $("#custom-multiplayer-room-selection-dialog-container").css("display") !==
    "none"
  ) {
    const directions = getMultiplayerRoomSelectionDialogDirections();
    if (element === "#room-to-join") {
      const input = document.getElementById("room-to-join") as HTMLInputElement;
      if (
        input &&
        input.value.length === input.selectionEnd &&
        keyPressed === "ArrowRight"
      ) {
        forcedDestination = directions[element]?.[keyPressed];
      }
    } else if (Object.keys(directions).includes(element)) {
      forcedDestination = directions[element]?.[keyPressed];
    } else {
      forcedDestination = "#custom-multiplayer-room-selection-dialog__close";
    }
    // unless there is no forcedDestination found, in that case, do nothing
    // and keep the focus where it is
    if (!forcedDestination) {
      return;
    }
  }
  // overwrite: if an input box is focused on, pushing left and right arrow keys should not
  // move on focused element, instead, it should move the caret in the input field.
  if (
    (keyPressed === "ArrowLeft" || keyPressed === "ArrowRight") &&
    $(element).is("input") &&
    !forcedDestination
  ) {
    return;
  }
  // overwrite: if there is nothing to arrow-key navigate to, do nothing.
  if (directions[screen] == null && !forcedDestination) {
    event.preventDefault();
    return;
  }
  // overwrite: if no object is highlighted, highlight the `defaultFocused` element.
  if (
    (element == null ||
      !Object.keys(directions[screen].destinations).includes(element)) &&
    !forcedDestination
  ) {
    event.preventDefault();
    const element = directions[screen].defaultFocused;
    if (!element) {
      return;
    }
    focusOnDefault(screen, element, keyPressed);
    return;
  }
  // normal case
  const destination =
    forcedDestination ||
    directions[screen]?.destinations?.[element]?.[keyPressed];
  event.preventDefault();
  // this function actually moves the focus.
  if (!destination) {
    console.debug(
      "Unable to move because destination string is falsy. This could be intentional!"
    );
    return;
  }
  const destinationElement = $(`${destination}`);
  if (!destinationElement) {
    console.warn("Unable to select destination element because it is falsy.");
    return;
  }
  changeFocus(destination);
}

function checkIfFocusedOnEndOfMessageBox(
  screen: string,
  element: string,
  keyPressed: string
) {
  let targetID = "";
  if (screen === "multiplayerIntermission") {
    targetID = "chat-message";
  } else if (screen === "customMultiplayerIntermission") {
    targetID = "custom-multiplayer-chat-message";
  } else {
    return false;
  }
  const input = document.getElementById(targetID) as HTMLInputElement;
  if (
    element === `#${targetID}` &&
    input &&
    input.value.length === input.selectionEnd &&
    keyPressed === "ArrowRight"
  ) {
    return true;
  }
  return false;
}

function checkIfFocusedOnEndOfChatTray(
  screen: string,
  element: string,
  keyPressed: string
) {
  const input = document.getElementById("chat-tray-input") as HTMLInputElement;
  if (
    input &&
    input.value.length === input.selectionEnd &&
    element === "#chat-tray-input" &&
    keyPressed === "ArrowRight"
  ) {
    return true;
  }
  return false;
}

function checkIfChatBoxShouldForceLeftArrowMove(
  screen: string,
  element: string,
  keyPressed: string
) {
  let elementID = element;
  if (element[0] === "#") {
    elementID = element.substring(1);
  }
  const input = document.getElementById(elementID) as HTMLInputElement;
  if (input && input.selectionStart === 0 && keyPressed === "ArrowLeft") {
    return true;
  }
  return false;
}

function focusPopup() {
  const popUpID =
    PopupNotification.activeNotificationIDs[
      PopupNotification.activeNotificationIDs.length - 1
    ];
  const popupToFocusID = `#popup-notification--${popUpID}__close-button`;
  const popupElement = $(popupToFocusID);
  popupElement.trigger("focus");
  popupElement.addClass("button--arrow-key-focused");
  variables.navigation.focusing = popupToFocusID;
}

function focusOnDefault(screen: string, element: string, keyPressed: string) {
  // focus on the `defaultFocus` element if nothing is arrow-key focused
  const destinationElement = $(`${element}`);
  // remove old element's focus status
  const oldElement = $(variables.navigation.focusing);
  if (oldElement) {
    oldElement.removeClass("button--arrow-key-focused");
  }
  // focus new element
  destinationElement.trigger("focus");
  destinationElement.addClass("button--arrow-key-focused");
  variables.navigation.focusing = element;
}

function changeFocus(destination: string) {
  const destinationElement = $(`${destination}`);
  // remove old element's focus status
  const oldElement = $(variables.navigation.focusing);
  if (oldElement) {
    oldElement.removeClass("button--arrow-key-focused");
  }
  // focus new element
  destinationElement.trigger("focus");
  destinationElement.addClass("button--arrow-key-focused");
  variables.navigation.focusing = destination;
}

export { navigateFocus, getArrowKeyDirections };
