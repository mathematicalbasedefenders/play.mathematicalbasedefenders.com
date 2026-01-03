import { log } from "./log";
import * as universal from "../universal";
import * as utilities from "../core/utilities";
import {
  defaultMultiplayerRoomID,
  processKeypressForRoom,
  Room
} from "../game/Room";
import {
  GameData,
  GameMode,
  MultiplayerGameData,
  SingleplayerGameData
} from "../game/GameData";
import {
  findRoomWithConnectionID,
  getUserReplayDataFromSocket
} from "./utilities";
import { Action, ActionRecord } from "../replay/recording/ActionRecord";
import _ from "lodash";
import { MultiplayerRoom } from "../game/MultiplayerRoom";
import { UserData } from "../universal";
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
  keyPressed?: string;
  argument: string;
}
const SEND_KEYS = ["Space", "Enter", "NumpadEnter"];
const MAXIMUM_INPUT_LENGTH = 8;

/**
 * Emulates a keypress for a player as if the player pressed the key themselves.
 * Note that it will also log that the press is emulated.
 * @param {universal.GameWebSocket<UserData>} socket
 * @param {string} code
 */
function emulateKeypress(
  socket: universal.GameWebSocket<UserData>,
  code: string
) {
  const connectionID = socket.getUserData().connectionID;
  const playerName = universal.getNameFromConnectionID(connectionID || "");
  if (!connectionID) {
    log.warn(`Socket has no ID.`);
    return;
  }
  if (typeof connectionID !== "string") {
    log.warn(
      "An emulated keypress event that isn't associated with any socket connectionID has been fired."
    );
    return;
  }
  log.info(
    `Keypress ${code} emulated on Socket ID ${connectionID} (${playerName})`
  );
  if (typeof code !== "string") {
    log.warn("An emulated keypress event that isn't a string has been fired.");
    return;
  }
  // TODO: What if player isn't in a room? (e.g. Multiplayer Room Intermission)
  processKeypress(socket, code, true);
}

function processKeypress(
  socket: universal.GameWebSocket<UserData>,
  code: string | undefined,
  emulated?: boolean
) {
  const connectionID = socket.getUserData().connectionID;
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
  // room
  const room = findRoomWithConnectionID(connectionID, false);
  if (room) {
    room.gameActionRecord.addAction({
      scope: "player",
      action: Action.Keypress,
      timestamp: Date.now(),
      user: getUserReplayDataFromSocket(socket),
      data: {
        code: code,
        emulated: emulated ?? false
      }
    });
  }

  processKeypressForRoom(connectionID, code, emulated);
  // non-room interactions
  if (code === "Escape") {
    let socket = universal.sockets.find(
      (socket) => socket.getUserData().connectionID === connectionID
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
      gameDataToProcess.addDigitToGameDataInput(inputInformation);
      break;
    }
    case InputAction.RemoveDigit: {
      gameDataToProcess.removeDigitFromGameDataInput(inputInformation);
      break;
    }
    case InputAction.AddSubtractionSign: {
      gameDataToProcess.addSubtractionSignToGameDataInput();
      break;
    }
    case InputAction.SendAnswer: {
      sendAnswerForGameDataInput(gameDataToProcess);
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
  if (NUMBER_PAD_KEYS.includes(code)) {
    return {
      action: InputAction.AddDigit,
      argument: NUMBER_PAD_KEYS.indexOf(code).toString()
    };
  }
  // TODO: consider checking inputInformation as well, to save probably less than a millisecond of time
  if (NUMBER_ROW_KEYS.includes(code)) {
    return {
      action: InputAction.AddDigit,
      argument: NUMBER_ROW_KEYS.indexOf(code).toString()
    };
  }
  if (REMOVE_DIGIT_KEYS.includes(code)) {
    return {
      action: InputAction.RemoveDigit,
      argument: ""
    };
  }
  if (SEND_KEYS.includes(code)) {
    return {
      action: InputAction.SendAnswer,
      argument: "" // TODO: Optionally put in current game data's current Input
    };
  }
  if (SUBTRACTION_SIGN_KEYS.includes(code)) {
    return {
      action: InputAction.AddSubtractionSign,
      argument: "" // TODO: Optionally put in current game data's current Input
    };
  }
  if (ABORT_KEYS.includes(code)) {
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

/**
 * Releases ALL the enemies in a `GameData`'s enemy stock.
 * @param {GameData} gameDataToProcess The `GameData` of the instance to release enemy stock.
 * @param {Room} room The `Room` to add the enemies to. This should be the same as `GameData`'s location.
 */
function releaseEnemyStock(gameDataToProcess: GameData, room: Room) {
  // incorrect answers with enemies in stock - add from stock to to spawn
  gameDataToProcess.receivedEnemiesToSpawn +=
    gameDataToProcess.receivedEnemiesStock;
  gameDataToProcess.receivedEnemiesStock = 0;
  room?.gameActionRecord.addStockReleaseAction(gameDataToProcess);
}

// This just attempts to leave.
function leaveMultiplayerRoom(socket: universal.GameWebSocket<UserData>) {
  // TODO: Implement for spectators when spectators are implemented.
  const connectionID = socket.getUserData().connectionID;
  const room = findRoomWithConnectionID(connectionID);
  if (!room) {
    log.warn(`Socket tried to leave a room, but it wasn't found.`);
    return;
  }
  if (room.playing) {
    const gameData = utilities.findGameDataWithConnectionID(connectionID, room);
    if (gameData) {
      room.abort(gameData);
    }
  }
  if (room.mode === GameMode.DefaultMultiplayer) {
    if (defaultMultiplayerRoomID) {
      socket.unsubscribe(defaultMultiplayerRoomID);
    }
  } else if (room.mode === GameMode.CustomMultiplayer) {
    if (!(room instanceof MultiplayerRoom)) {
      log.warn("CustomMultiplayer room code called on non-multiplayer room.");
      return;
    }
    if (!connectionID) {
      log.warn("Socket doesn't have a connection ID when leaving room.");
      return;
    }
    if (room.host?.getUserData().connectionID === connectionID) {
      // Note that `.abort` already removes the
      // connectionID from `room.memberConnectionIDs`
      // So, there is no need to delete member here.
      const pool = _.clone(room.memberConnectionIDs);
      // It's here since we have to find a new host, and if there's only
      // one socket before leaving, the room is empty and can be destroyed.

      if (pool.length === 0) {
        // TODO: Find a more stable way to do this. Right now it is sufficient since 1-1=0, and
        // there's no point in keeping a 0-player room in memory.

        // room.addChatMessage("No one in the room, deleting room...", {
        //   isSystemMessage: true
        // });
        log.info(`About to delete room ${room.id}...`);
      } else {
        if (pool.length >= 1) {
          // sample randoms from pool
          const newHostID = _.sample(pool) as string;
          room.setNewHost(newHostID);

          // also send new chat message indicating the new host.
          const pastHost = universal.getNameFromConnectionID(connectionID);
          const newHost = universal.getNameFromConnectionID(newHostID);
          const message = `This room's host is now ${newHost}, since the original host, ${pastHost} has left the room.`;
          room.addChatMessage(message, { isSystemMessage: true });

          // notify the new host as well
          const newHostSocket = universal.getSocketFromConnectionID(newHostID);
          const MESSAGE =
            "You have been randomly selected to be the new host of this room since the previous host left.";

          if (!newHostSocket) {
            room.sendCommandResultToSocket(MESSAGE, { sender: newHostSocket });
          }

          log.info(`Room ${room.id}'s host now ${newHost} from ${pastHost}.`);
        }
      }
    }
    socket.unsubscribe(room.id);
  }
  room.deleteMember(socket);
}

function sendAnswerForGameDataInput(gameData: GameData) {
  let enemyKilled = false;
  const room = findRoomWithConnectionID(gameData.ownerConnectionID);
  const socketID = gameData.ownerConnectionID;

  if (!room) {
    // should never reach here, but here just in case.
    log.warn(`Can't find room when sending answer for socket ID ${socketID}.`);
    return;
  }

  const ownerSocket = universal.getSocketFromConnectionID(socketID);

  const submissionRecord: ActionRecord = {
    action: Action.Submit,
    scope: "player",
    user: ownerSocket
      ? getUserReplayDataFromSocket(ownerSocket)
      : {
          userID: null,
          name: "(unknown)",
          isAuthenticated: false,
          connectionID: ""
        },
    data: {
      submitted: gameData.currentInput
    },
    timestamp: Date.now()
  };
  room.gameActionRecord.addAction(submissionRecord);

  const enemyIDsToKill = getKilledEnemyIDs(gameData);
  for (const enemyID of enemyIDsToKill) {
    const enemy = gameData.enemies.find((e) => e.id === enemyID);
    if (!enemy) {
      log.warn(`Can't find enemy to kill in room ${room.id}.`);
      continue;
    }
    enemy.kill(gameData, true, true);
    room.gameActionRecord.addEnemyKillAction(enemy, gameData);

    gameData.enemiesToErase.push(enemyID);
    gameData.processEnemyKill(1, room);
  }

  if (enemyIDsToKill.length > 0) {
    gameData.clearInput();
  } else {
    // no enemies killed on submission in
    // multiplayer: release enemy stock
    if (gameData instanceof MultiplayerGameData) {
      releaseEnemyStock(gameData, room);
    }
  }
}

function getKilledEnemyIDs(gameData: GameData) {
  const enemyIDsToKill: Array<string> = [];

  if (!/^\-{0,1}[0-9]{1,8}$/.test(gameData.currentInput)) {
    // invalid input, e.g. --53, -3-5, and the like.
    return [];
  }

  for (const enemy of gameData.enemies) {
    // TODO: Data validation
    if (enemy.check(parseInt(gameData.currentInput))) {
      // gameData.enemiesToErase.push(enemy.id);
      enemyIDsToKill.push(enemy.id);
    }
  }
  return enemyIDsToKill;
}

export {
  processKeypress,
  getInputInformation,
  processInputInformation,
  emulateKeypress,
  InputAction,
  leaveMultiplayerRoom,
  InputActionInterface
};
