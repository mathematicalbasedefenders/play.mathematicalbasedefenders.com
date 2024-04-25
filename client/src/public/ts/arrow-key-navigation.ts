import { variables } from ".";

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
  if (element == null) {
    element = directions[screen].defaultFocused;
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
  // remove old element
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
