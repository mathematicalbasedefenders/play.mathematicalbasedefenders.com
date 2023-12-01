import { log } from "./log";
import * as universal from "../universal";
import {
  defaultMultiplayerRoomID,
  leaveMultiplayerRoom,
  processKeypressForRoom
} from "../game/Room";
import {
  GameData,
  GameMode,
  MultiplayerGameData,
  SingleplayerGameData
} from "../game/GameData";
import { findRoomWithConnectionID } from "./utilities";
// kind of a hacky way to do this...
const NUMBER_ROW_KEYS = [
  "Digit0",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "Digit9"
];
const NUMBER_PAD_KEYS = [
  "Numpad0",
  "Numpad1",
  "Numpad2",
  "Numpad3",
  "Numpad4",
  "Numpad5",
  "Numpad6",
  "Numpad7",
  "Numpad8",
  "Numpad9"
];
const REMOVE_DIGIT_KEYS = ["NumpadAdd", "Backspace"];
const SUBTRACTION_SIGN_KEYS = ["Minus", "NumpadSubtract"];
const ABORT_KEYS = ["Escape"];
enum InputAction {
  Unknown = 0,
  AddDigit = "G1",
  RemoveDigit = "G2",
  SendAnswer = "G3",
  AddSubtractionSign = "G4",
  AbortGame = "M1"
}
interface InputActionInterface {
  action: InputAction;
  argument: string;
}
const SEND_KEYS = ["Space", "Enter"];

/**
 * Emulates a keypress for a player as if the player pressed the key themselves.
 * Note that it will also log that the press is emulated.
 * @param {universal.GameSocket} socket
 * @param {string} code
 */
function emulateKeypress(
  socket: universal.GameSocket,
  code: string | undefined
) {
  const connectionID = socket.connectionID;
  const playerName = universal.getNameFromConnectionID(connectionID || "");
  if (!connectionID) {
    log.warn(`Socket has no ID.`);
    return;
  }
  log.info(
    `Keypress ${code} emulated on Socket ID ${connectionID} (${playerName})`
  );
  if (typeof connectionID !== "string") {
    log.warn(
      "An emulated keypress event that isn't associated with any socket connectionID has been fired."
    );
    return;
  }
  if (typeof code !== "string") {
    log.warn("An emulated keypress event that isn't a string has been fired.");
    return;
  }
  // TODO: What if player isn't in a room? (e.g. Multiplayer Room Intermission)
  processKeypress(socket, code);
}

function processKeypress(
  socket: universal.GameSocket,
  code: string | undefined
) {
  const connectionID = socket.connectionID;
  if (!connectionID) {
    log.warn(`Socket has no ID.`);
    return;
  }
  // data validation point
  if (typeof connectionID !== "string") {
    log.warn(
      "A keypress event that isn't associated with any socket connectionID has been fired."
    );
    return;
  }
  if (typeof code !== "string") {
    log.warn("A keypress event that isn't a string has been fired.");
    return;
  }
  processKeypressForRoom(connectionID, code);
  // non-room interactions
  if (code === "Escape") {
    let socket = universal.sockets.find(
      (socket) => socket.connectionID === connectionID
    );
    if (socket) {
      leaveMultiplayerRoom(socket);
      socket.send(
        JSON.stringify({
          message: "changeScreen",
          newScreen: "mainMenu"
        })
      );
    }
  }
}

/**
 * Processes an input for a room.
 * @param {InputActionInterface} inputInformation The input info
 * @param {GameData} gameDataToProcess The game data to process on
 */
function processInputInformation(
  inputInformation: InputActionInterface,
  gameDataToProcess: GameData
) {
  // also increment actionsPerformed
  gameDataToProcess.actionsPerformed++;
  switch (inputInformation.action) {
    case InputAction.AddDigit: {
      if (gameDataToProcess.currentInput.length > 7) {
        return;
      }
      gameDataToProcess.currentInput += inputInformation.argument.toString();
      break;
    }
    case InputAction.RemoveDigit: {
      gameDataToProcess.currentInput = gameDataToProcess.currentInput.substring(
        0,
        gameDataToProcess.currentInput.length - 1
      );
      break;
    }
    case InputAction.AddSubtractionSign: {
      if (gameDataToProcess.currentInput.length > 7) {
        return;
      }
      gameDataToProcess.currentInput += "-";
      break;
    }
    case InputAction.SendAnswer: {
      let enemyKilled = false;
      for (let enemy of gameDataToProcess.enemies) {
        // TODO: Data validation
        if (enemy.check(parseInt(gameDataToProcess.currentInput))) {
          gameDataToProcess.enemiesToErase.push(enemy.id);
          enemyKilled = true;
          gameDataToProcess.enemiesKilled += 1;
          if (gameDataToProcess instanceof SingleplayerGameData) {
            gameDataToProcess.enemiesToNextLevel -= 1;
            if (gameDataToProcess.enemiesToNextLevel <= 0) {
              gameDataToProcess.increaseLevel(1);
            }
          }
          enemy.kill(gameDataToProcess, true, true);
        }
      }
      // reset input
      if (enemyKilled) {
        gameDataToProcess.currentInput = "";
      } else {
        if (gameDataToProcess instanceof MultiplayerGameData) {
          // incorrect answers with enemies in stock - add from stock to to spawn
          gameDataToProcess.receivedEnemiesToSpawn +=
            gameDataToProcess.receivedEnemiesStock;
          gameDataToProcess.receivedEnemiesStock = 0;
        }
      }
      break;
    }
    case InputAction.AbortGame: {
      gameDataToProcess.aborted = true;
      // this just attempts to leave a room.
      break;
    }
  }
}

/**
 * Gets Keyboard input information
 * @param {string} code The key.code of the pressed key
 * @returns {object} An object detailing what action and argument to pass to the next function.
 */
function getInputInformation(code: string) {
  if (NUMBER_PAD_KEYS.indexOf(code) > -1) {
    return {
      action: InputAction.AddDigit,
      argument: NUMBER_PAD_KEYS.indexOf(code).toString()
    };
  }
  // TODO: consider checking inputInformation as well, to save probably less than a millisecond of time
  if (NUMBER_ROW_KEYS.indexOf(code) > -1) {
    return {
      action: InputAction.AddDigit,
      argument: NUMBER_ROW_KEYS.indexOf(code).toString()
    };
  }
  if (REMOVE_DIGIT_KEYS.indexOf(code) > -1) {
    return {
      action: InputAction.RemoveDigit,
      argument: ""
    };
  }
  if (SEND_KEYS.indexOf(code) > -1) {
    return {
      action: InputAction.SendAnswer,
      argument: "" // TODO: Optionally put in current game data's current Input
    };
  }
  if (SUBTRACTION_SIGN_KEYS.indexOf(code) > -1) {
    return {
      action: InputAction.AddSubtractionSign,
      argument: "" // TODO: Optionally put in current game data's current Input
    };
  }
  if (ABORT_KEYS.indexOf(code) > -1) {
    return {
      action: InputAction.AbortGame,
      argument: ""
    };
  }
  return {
    action: InputAction.Unknown,
    argument: "" // no need
  };
}

export {
  processKeypress,
  getInputInformation,
  processInputInformation,
  emulateKeypress,
  InputAction
};
