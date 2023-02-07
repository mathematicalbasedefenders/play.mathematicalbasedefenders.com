import { log } from "./log";
import { GameData, processKeypressForRoom } from "../game/Room";
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

enum InputAction {
  Unknown = 0,
  AddDigit = 1,
  RemoveDigit = 2,
  SendAnswer = 3,
  AddSubtractionSign = 4
}
interface InputActionInterface {
  action: InputAction;
  argument: string;
}
const SEND_KEYS = ["Space", "Enter"];

function processKeypress(
  connectionID: string | undefined,
  code: string | undefined
) {
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
}

function processInputInformation(
  inputInformation: InputActionInterface,
  gameDataToProcess: GameData
) {
  switch (inputInformation.action) {
    case InputAction.AddDigit: {
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
      gameDataToProcess.currentInput += "-";
    }
    case InputAction.SendAnswer: {
      let enemyKilled = false;
      for (let enemy of gameDataToProcess.enemies) {
        if (enemy.check(parseInt(gameDataToProcess.currentInput))) {
          gameDataToProcess.enemiesToErase.push(enemy.id);
          enemyKilled = true;
          gameDataToProcess.enemiesKilled += 1;
          enemy.kill(gameDataToProcess);
        }
      }
      // reset input
      if (enemyKilled) {
        gameDataToProcess.currentInput = "";
      }
      break;
    }
  }
}

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
  return {
    action: InputAction.Unknown,
    argument: "" // no need
  };
}

export { processKeypress, getInputInformation, processInputInformation };
