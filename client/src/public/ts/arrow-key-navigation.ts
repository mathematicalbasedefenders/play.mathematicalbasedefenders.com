import _ from "lodash";
import { variables } from ".";
import { PopupNotification } from "./notifications";

// Globals
const settingsSecondaryScreenOrder: { [key: string]: Array<string> } = {
  "online": [
    "#settings-screen__content--online__username",
    "#settings-screen__content--online__password",
    "#settings-screen__content--online__submit"
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
    "#settings-level-display__high"
  ],
  "audio": ["#settings-sound__on", "#settings-sound__off"]
};

/**
 * New destination: directions.(currentScreen).destinations.(currentElement).(keyPressed)
 */
function getArrowKeyDirections() {
  const directions: { [key: string]: any } = {
    "mainMenu": {
      destinations: {
        "#main-menu-screen-button--singleplayer": {
          "ArrowDown": "#main-menu-screen-button--multiplayer"
        },
        "#main-menu-screen-button--multiplayer": {
          "ArrowUp": "#main-menu-screen-button--singleplayer",
          "ArrowDown": "#main-menu-screen-button--settings"
        },
        "#main-menu-screen-button--settings": {
          "ArrowUp": "#main-menu-screen-button--multiplayer"
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
    "settingsMenu": getSettingsMenuDestinations(
      variables.navigation.currentSecondaryScreen
    )
  };
  return directions;
}

function getSettingsMenuDestinations(secondaryScreen: string) {
  const result: { [key: string]: any } = {
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
  if (secondaryScreen == null || secondaryScreen === "") {
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
  // add `ArrowLeft` action
  for (const key of settingsSecondaryScreenOrder[secondaryScreen]) {
    result.destinations[key]["ArrowLeft"] =
      "#settings-screen__sidebar-item--back";
  }
  console.debug(result);
  return result;
}

/**
 * Utility function which constructs a object for easy `ArrowUp/ArrowDown` navigation.
 * @param {Array<string>} ids The ids of each element in order.
 * @returns An object where for each string,
 * ArrowUp will lead to one before it, and ArrowDown will lead to one after it.
 */
function constructUpDownKeyDirections(ids: Array<string>) {
  const result: { [key: string]: any } = {};
  for (let i = 0; i < ids.length; i++) {
    if (i == 0) {
      result[ids[i]] = {
        "ArrowDown": ids[i + 1]
      };
      continue;
    }
    if (i == ids.length - 1) {
      result[ids[i]] = {
        "ArrowUp": ids[i - 1]
      };
      continue;
    }
    result[ids[i]] = {
      "ArrowUp": ids[i - 1],
      "ArrowDown": ids[i + 1]
    };
  }
  return result;
}

/**
 * Changes/navigates the focused element based on the current screen shown
 * (and the focused element) and the pressed key.
 * The focused element is already stored in `variables.navigation`,
 * so there is no need to pass it as a parameter.
 * @param {string} keyPressed The key that the user pressed.
 */
function navigateFocus(keyPressed: string) {
  let screen = variables.navigation.currentScreen;
  let element = variables.navigation.focusing;
  console.debug("PREV: ", element);
  const directions = getArrowKeyDirections();
  // overwrite: if there is a popup notification active, give it priority.
  if (PopupNotification.activeNotifications > 0) {
    // right now, there will be only 1 pop-up notification active, which is the "Hello!" popup.
    // currently, later notifications are given priority when dealing with arrow keys.
    const popUpID =
      PopupNotification.activeNotificationIDs[
        PopupNotification.activeNotificationIDs.length - 1
      ];
    const popupToFocusID = `#popup-notification--${popUpID}__close-button`;
    const popupElement = $(popupToFocusID);
    popupElement.trigger("focus");
    popupElement.addClass("button--arrow-key-focused");
    variables.navigation.focusing = popupToFocusID;
    return;
  }
  // overwrite: if no object is highlighted, highlight the `defaultFocused` element.
  if (
    element == null ||
    Object.keys(directions[screen].destinations).indexOf(element) === -1
  ) {
    console.debug(directions);
    element = directions[screen].defaultFocused;
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
    return;
  }
  // normal case
  const destination = directions[screen]?.destinations?.[element]?.[keyPressed];
  if (!destination) {
    // no element corresponds to destination
    return;
  }
  const destinationElement = $(`${destination}`);
  if (!destinationElement) {
    console.warn("Unable to select destination element because it is falsy.");
    return;
  }
  // remove old element's focus status
  const oldElement = $(variables.navigation.focusing);
  if (oldElement) {
    oldElement.removeClass("button--arrow-key-focused");
  }
  // focus new element
  destinationElement.trigger("focus");
  destinationElement.addClass("button--arrow-key-focused");
  variables.navigation.focusing = destination;
  console.debug("NOW: ", element);
}

export { navigateFocus, getArrowKeyDirections };
