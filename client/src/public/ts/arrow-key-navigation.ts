import _ from "lodash";
import { variables } from ".";
import { PopupNotification } from "./notifications";

/**
 * New destination: directions.(currentScreen).destinations.(currentElement).(keyPressed)
 */
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
  }
};

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
  console.debug(element);
  // normal case
  if (
    element == null ||
    Object.keys(directions[screen].destinations).indexOf(element) === -1
  ) {
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
}

export { navigateFocus, directions };
