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
  keyPressed?: string | undefined;
  argument: string;
}
const SEND_KEYS = ["Space", "Enter"];
const MAXIMUM_INPUT_LENGTH = 7;
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
  processKeypress(socket, code, true);
}

function processKeypress(
  socket: universal.GameSocket,
  code: string | undefined,
  emulated?: boolean
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
      if (gameDataToProcess.currentInput.length >= MAXIMUM_INPUT_LENGTH) {
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
      if (gameDataToProcess.currentInput.length >= MAXIMUM_INPUT_LENGTH) {
        return;
      }
      gameDataToProcess.currentInput += "-";
      break;
    }
    case InputAction.SendAnswer: {
      let enemyKilled = false;
      const room = findRoomWithConnectionID(
        gameDataToProcess.ownerConnectionID
      );

      if (room) {
        const ownerSocket = universal.getSocketFromConnectionID(
          gameDataToProcess.ownerConnectionID
        );
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
            submitted: gameDataToProcess.currentInput
          },
          timestamp: Date.now()
        };
        room.gameActionRecord.addAction(submissionRecord);
      }

      for (let enemy of gameDataToProcess.enemies) {
        // TODO: Data validation
        if (enemy.check(parseInt(gameDataToProcess.currentInput))) {
          gameDataToProcess.enemiesToErase.push(enemy.id);
          enemyKilled = true;
          gameDataToProcess.enemiesKilled += 1;
          if (gameDataToProcess instanceof SingleplayerGameData) {
            gameDataToProcess.enemiesToNextLevel -= 1;

            if (room) {
              room.gameActionRecord.addSetGameDataAction(
                gameDataToProcess,
                "player",
                "enemiesToNextLevel",
                _.get(gameDataToProcess, "enemiesToNextLevel")
              );
            }

            if (gameDataToProcess.enemiesToNextLevel <= 0) {
              gameDataToProcess.increaseLevel(1);
              updateReplayClockData(gameDataToProcess, room as Room);
            }
          }
          enemy.kill(gameDataToProcess, true, true);
          if (room) {
            if (
              gameDataToProcess.mode === GameMode.EasySingleplayer ||
              gameDataToProcess.mode === GameMode.StandardSingleplayer
            ) {
              room.gameActionRecord.addSetGameDataAction(
                gameDataToProcess,
                "player",
                "score",
                gameDataToProcess.score
              );
            } else if (gameDataToProcess.mode === GameMode.DefaultMultiplayer) {
              room.gameActionRecord.addSetGameDataAction(
                gameDataToProcess,
                "player",
                "attackScore",
                gameDataToProcess.attackScore
              );
            }
            room.gameActionRecord.addEnemyKillAction(enemy, gameDataToProcess);
          }
        }
      }
      if (enemyKilled) {
        const ownerSocket = universal.getSocketFromConnectionID(
          gameDataToProcess.ownerConnectionID
        );
        if (ownerSocket) {
          ownerSocket.send(
            JSON.stringify({
              message: "clearInput",
              data: {
                toClear: gameDataToProcess.currentInput.toString()
              }
            })
          );
        }
        gameDataToProcess.currentInput = "";
      }
      // reset input
      if (!enemyKilled) {
        if (gameDataToProcess instanceof MultiplayerGameData) {
          releaseEnemyStock(gameDataToProcess, room as Room);
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

/**
 * Updates clock data so that replays can be accurate.
 * @param {GameData} gameDataToProcess
 * @param {room} room
 */
function updateReplayClockData(gameDataToProcess: GameData, room: Room) {
  // update replay data
  const keys = [
    "clocks.enemySpawn.actionTime",
    "enemySpeedCoefficient",
    "baseHealthRegeneration",
    "level"
  ];

  for (const key of keys) {
    room.gameActionRecord.addSetGameDataAction(
      gameDataToProcess,
      "player",
      key,
      _.get(gameDataToProcess, key)
    );
  }
}

// This just attempts to leave.
function leaveMultiplayerRoom(socket: universal.GameSocket) {
  // TODO: Implement for spectators when spectators are implemented.
  let room = universal.rooms.find(
    (element) =>
      element.memberConnectionIDs.indexOf(socket.connectionID as string) > -1
  );
  if (!room) {
    log.warn(`Socket tried to leave a room, but it wasn't found.`);
    return;
  }
  if (room.playing) {
    let gameData = utilities.findGameDataWithConnectionID(
      socket.connectionID as string,
      room
    );
    if (gameData) {
      room.abort(gameData);
    }
  }
  if (room.mode === GameMode.DefaultMultiplayer) {
    if (defaultMultiplayerRoomID) {
      socket.unsubscribe(defaultMultiplayerRoomID);
    }
  } else if (room.mode === GameMode.CustomMultiplayer) {
    if (!socket.connectionID) {
      log.warn("Socket doesn't have a connection ID when leaving room.");
      return;
    }
    if ((room as MultiplayerRoom).host?.connectionID === socket.connectionID) {
      const pool = room.memberConnectionIDs.filter(
        (e) => e !== socket.connectionID
      );
      // It's here since we have to find a new host, and if there's only
      // one socket before leaving, the room is empty and can be destroyed.
      if (pool.length >= 1) {
        const newHostID = _.sample(pool);
        (room as MultiplayerRoom).setNewHost(newHostID as string);

        // also send new chat message indicating the new host.
        const pastHost = universal.getNameFromConnectionID(socket.connectionID);
        const newHost = universal.getNameFromConnectionID(newHostID as string);
        const message = `This room's host is now ${newHost}, since the original host, ${pastHost} has left the room.`;
        room.addChatMessage(message, { isSystemMessage: true });
        log.info(`Room ${room.id}'s host is now ${newHost} from ${pastHost}.`);
      } else {
        // TODO: Find a more stable way to do this. Right now it is sufficient since 1-1=0, and
        // there's no point in keeping a 0-player room in memory.

        // room.addChatMessage("No one in the room, deleting room...", {
        //   isSystemMessage: true
        // });
        log.info(`About to delete room ${room.id}...`);
      }
    }
    socket.unsubscribe(room.id);
  }
  room.deleteMember(socket);
}

export {
  processKeypress,
  getInputInformation,
  processInputInformation,
  emulateKeypress,
  InputAction,
  leaveMultiplayerRoom
};
