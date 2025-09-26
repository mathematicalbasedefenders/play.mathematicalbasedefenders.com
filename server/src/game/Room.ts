import * as utilities from "../core/utilities";
import * as universal from "../universal";
import * as _ from "lodash";
import { log } from "../core/log";
import * as input from "../core/input";
import { InputAction } from "../core/input";
import { findRoomWithConnectionID } from "../core/utilities";
import {
  GameData,
  GameMode,
  CustomGameSettings,
  MultiplayerGameData
} from "./GameData";
import { GameActionRecord } from "../replay/recording/ActionRecord";
import { Enemy } from "./Enemy";
import { MultiplayerRoom } from "./MultiplayerRoom";

const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
let defaultMultiplayerRoomID: string | null = null;

interface InputActionInterface {
  action: InputAction;
  argument: string;
  keyPressed?: string | undefined;
}

interface MinifiedGameDataInterface {
  owner: string;
  ownerName?: string;
  baseHealth?: number;
  combo?: number;
  currentInput?: string;
  receivedEnemiesStock?: number;
  enemies?: Array<Enemy>;
  enemiesToErase?: Array<string>;
}

class Room {
  id: string;
  host: universal.GameSocket | null;
  memberConnectionIDs: Array<string> = [];
  spectatorConnectionIDs: Array<string> = [];
  updateNumber: number = 0;
  playing: boolean = false;
  gameData: Array<GameData> = [];
  lastUpdateTime: number;
  mode!: GameMode;
  connectionIDsThisRound: Array<string> = [];
  ranking: Array<any> = [];
  chatMessages: Array<unknown> = [];
  updating: boolean = false;
  // custom room exclusive
  customSettings!: CustomGameSettings;

  // new update 2025-03-31
  gameActionRecord: GameActionRecord;

  // new update 2025-09-22
  ageInMilliseconds: number = 0;

  /**
   * Creates a `Room` instance. This shouldn't be called directly.
   * Instead it should be called from a `super()` call from either
   * a new `SingleplayerRoom` or a new `MultiplayerRoom`.
   * Note: A Room will only "start to function" when it is in `universal.rooms`.
   * @param {universal.GameSocket} host The socket that asked for the room.
   * @param {GameMode} gameMode The game mode of the room
   * @param {boolean} noHost Should only be `true` on Default Multiplayer.
   * @returns
   */
  constructor(
    host: universal.GameSocket,
    gameMode: GameMode,
    noHost?: boolean
  ) {
    this.mode = gameMode;
    this.id = generateRoomID(8);
    if (noHost) {
      // should only be used for default multiplayer
      this.host = null;
    } else {
      this.host = host;
    }
    this.connectionIDsThisRound = [];
    this.lastUpdateTime = Date.now();

    this.gameActionRecord = new GameActionRecord();

    log.info(`Created ${gameMode} room with ID ${this.id}`);
  }

  update(deltaTime: number) {
    // update things that need to be updated, regardless if room is in active play
    this.ageInMilliseconds += deltaTime;

    if (!this.playing && !this.updating) {
      return;
    }

    for (let i = 0; i < this.gameData.length; i++) {
      this.gameData[i].elapsedTime += deltaTime;
      for (let clock in this.gameData[i].clocks) {
        this.gameData[i].clocks[clock].currentTime += deltaTime;
      }
    }

    this.updateNumber++;
  }

  // room specific
  addChatMessage(message: string, options: { [key: string]: any }) {
    if (
      !options.isSystemMessage &&
      (!options.sender || !options.sender.connectionID)
    ) {
      log.warn(
        `No sender/connectionID for message: ${message} in room, ignoring.`
      );
      return;
    }

    const messageToSend = {
      sanitizedMessage: "",
      senderName: "",
      nameColor: "",
      userID: ""
    };

    if (options.isSystemMessage) {
      messageToSend.sanitizedMessage = DOMPurify.sanitize(message);
      messageToSend.senderName = "(System)";
      messageToSend.nameColor = "#06aa06";
      messageToSend.userID = "";
    } else if (options.sender) {
      messageToSend.sanitizedMessage = DOMPurify.sanitize(message);
      messageToSend.senderName =
        universal.getNameFromConnectionID(options.sender.connectionID || "") ||
        "";
      messageToSend.nameColor = options.sender.playerRank?.color ?? "#ffffff";
      messageToSend.userID = options.sender.ownerUserID ?? "";
    }

    this.chatMessages.push({
      message: messageToSend.sanitizedMessage,
      senderName: messageToSend.senderName
    });

    // send to all sockets
    for (const connectionID of this.memberConnectionIDs) {
      const socket = universal.getSocketFromConnectionID(connectionID);
      if (!socket) {
        continue;
      }
      socket.send(
        JSON.stringify({
          message: "addRoomChatMessage",
          // selector:
          //   "#main-content__multiplayer-intermission-screen-container__chat__messages",
          scope:
            this.mode == GameMode.DefaultMultiplayer ? "default" : "custom",
          data: {
            name: DOMPurify.sanitize(messageToSend.senderName),
            message: DOMPurify.sanitize(message),
            nameColor: messageToSend.nameColor,
            userID: messageToSend.userID
          }
        })
      );
    }

    // log the chat message
    log.info(
      `${messageToSend.senderName} sent message ${message} to Room ID ${this.id}`
    );
  }

  /**
   * Runs a chat command
   * @param {string} message The original message to use as the command.
   * @param {{[key: string]:any}} options Any additional information to send.
   */
  runChatCommand(message: string, options?: { [key: string]: any }) {
    let isHost = false;

    if (!options?.sender) {
      log.warn(`Socket doesn't exist when running chat commands.`);
      return;
    }

    if (options?.sender.connectionID === this.host?.connectionID) {
      isHost = true;
    }

    // substring constant because we already know
    // index 0 in `message` is the `/`, which signifies
    // a chat command.
    const text = message.substring(1).split(" ");
    const [command, ...context] = text;

    switch (command) {
      case "start": {
        const result = this.validateStartCommandForRoom(isHost);

        if (!result.valid) {
          const commandErrorMessage = result.errors.join(", ");
          this.sendCommandResultToSocket(options, commandErrorMessage);
          break;
        }

        // give feedback
        // TODO: Add a delay for everyone to see when it's time to start.
        const commandSuccessMessage = `Successfully ran command \"/${command}\". Game will now start.`;
        this.sendCommandResultToSocket(options, commandSuccessMessage);

        // start multiplayer game
        try {
          (this as unknown as MultiplayerRoom).playersAtStart =
            this.memberConnectionIDs.length;
          (this as unknown as MultiplayerRoom).startPlay();
          (this as unknown as MultiplayerRoom).summonEveryoneToGameplay();
        } catch {
          // TODO: Refactor this
          log.error("Can't run /start command due to an internal error.");
          options.sender.send(
            JSON.stringify({
              message: "createToastNotification",
              text: `Can't run /start command due to an internal error. Please contact the server administrator!`,
              options: { borderColor: "#ff0000" }
            })
          );
        }

        break;
      }
      case "set": {
        const result = this.validateSetCommandForRoom(isHost, context);
        if (!result.valid) {
          const commandErrorMessage = result.errors.join(", ");
          this.sendCommandResultToSocket(options, commandErrorMessage);
          break;
        }
        this.setRoomConstant(context[0], context[1]);
        break;
      }
      default: {
        const message = `Unknown command \"/${command}\".`;
        this.sendCommandResultToSocket(options, message);
        break;
      }
    }

    // log the command
    const senderName =
      universal.getNameFromConnectionID(options.sender.connectionID || "") ||
      "";
    log.info(`${senderName} sent message ${message} to Room ID ${this.id}`);
  }

  /**
   * Adds the socket to this `Room` instance as a member.
   * @param {universal.GameSocket} caller The socket to add to the room (also the socket who called this function)
   */
  addMember(caller: universal.GameSocket) {
    const connectionID = caller.connectionID as string;
    if (
      !this.memberConnectionIDs.includes(connectionID) &&
      !this.spectatorConnectionIDs.includes(connectionID)
    ) {
      this.memberConnectionIDs.push(connectionID);
      log.info(
        `Added socket with ID ${connectionID} as a member to room ${this.id}`
      );
      caller.subscribe(this.id);
    } else {
      log.warn(
        `Did not add socket with ID ${connectionID} as it's already in this room.`
      );
    }
  }

  /**
   * Adds the socket to this `Room` instance as a spectator.
   * This hasn't been fully implemented yet.
   * @param {universal.GameSocket} caller The socket to add to the room (also the socket who called this function)
   */
  addSpectator(caller: universal.GameSocket) {
    const connectionID = caller.connectionID as string;
    if (
      !this.spectatorConnectionIDs.includes(connectionID) &&
      !this.memberConnectionIDs.includes(connectionID)
    ) {
      this.spectatorConnectionIDs.push(connectionID);
      log.info(
        `Added socket with ID ${connectionID} as a spectator to room ${this.id}`
      );
    } else {
      log.warn(
        `Did not add socket with ID ${connectionID} as it's already in this room.`
      );
    }
  }

  /**
   * Deletes the socket from this `Room` instance.
   * This requires that the socket is a member (and not a spectator),
   * @param {universal.GameSocket} caller The socket to delete from the room (also the socket who called this function)
   */
  deleteMember(caller: universal.GameSocket) {
    const connectionID = caller.connectionID as string;
    if (this.memberConnectionIDs.includes(connectionID)) {
      this.memberConnectionIDs.splice(
        this.memberConnectionIDs.indexOf(connectionID),
        1
      );
      log.info(
        `Deleted socket with ID ${connectionID} (member) from room ${this.id}`
      );
    }
  }

  /**
   * Deletes the socket from this `Room` instance.
   * This requires that the socket is a spectator (and not a member),
   * @param {universal.GameSocket} caller The socket to delete from the room (also the socket who called this function)
   */
  deleteSpectator(caller: universal.GameSocket) {
    const connectionID = caller.connectionID as string;
    if (this.spectatorConnectionIDs.includes(connectionID)) {
      this.spectatorConnectionIDs.splice(
        this.spectatorConnectionIDs.indexOf(connectionID),
        1
      );
      log.info(
        `Deleted socket with ID ${connectionID} (spectator) from room ${this.id}`
      );
    }
  }

  /**
   * Remove all of the room's players, then deletes the room.
   */
  destroy() {
    const members = _.clone(this.memberConnectionIDs);
    const spectators = _.clone(this.spectatorConnectionIDs);
    for (let spectator of spectators) {
      const socket = universal.getSocketFromConnectionID(spectator);
      if (socket) {
        this.deleteMember(socket);
      }
    }
    for (let member of members) {
      const socket = universal.getSocketFromConnectionID(member);
      if (socket) {
        this.deleteMember(socket);
      }
    }
    log.info(`Destroyed room ${this.id}`);
  }

  validateStartCommandForRoom(isHost: boolean) {
    let valid = true;
    let errors = [];
    if (!isHost) {
      errors.push("You must be the host to run this command.");
      valid = false;
    }
    if (!(this.mode === GameMode.CustomMultiplayer)) {
      errors.push("This command must be ran in a Custom Multiplayer room.");
      valid = false;
    }
    if (this.memberConnectionIDs.length < 2) {
      errors.push(
        "This command can only be ran when there are at least 2 players in the room."
      );
      valid = false;
    }
    if (this.playing) {
      errors.push(
        "This command can only be ran when there is no active game in progress."
      );
      valid = false;
    }
    return {
      valid: valid,
      errors: errors
    };
  }

  validateSetCommandForRoom(isHost: boolean, context: Array<string>) {
    const result: { valid: boolean; errors: Array<string> } = {
      valid: true,
      errors: []
    };

    // Command validation is broken here if it's invalid,
    // since the actual set operation needs two arguments,
    // the key and the value, which must be a valid integer.
    // Otherwise, continue, since the command could
    // be either valid or invalid, further checks are needed.
    if (context.length < 2) {
      result.valid = false;
      result.errors.push(`/set command must have at least 2 arguments.`);
      return result;
    }

    const constantToChange = context[0].toLowerCase();
    const newValueAsString = context[1];

    const SAFE_INTEGER_REGEX = /^[0-9]{0,7}$/;

    // Early stop for the same reason above.
    // TODO: For now, all values are integers, so some expansion
    // is needed when the values can be (e.g.) string enums.
    if (!SAFE_INTEGER_REGEX.test(newValueAsString)) {
      result.valid = false;
      result.errors.push(`New value is not in safe value.`);
      return result;
    }

    // At this point, the command's form is considered to be "correct",
    // However, further checks on the CONTEXT of the command's runner and the room
    // is required, just like how the host can only issue commands on non-active games.
    if (!isHost) {
      result.errors.push("You must be the host to run this command.");
      result.valid = false;
    }
    if (!(this.mode === GameMode.CustomMultiplayer)) {
      result.errors.push(
        "This command must be ran in a Custom Multiplayer room."
      );
      result.valid = false;
    }
    if (this.playing) {
      result.errors.push(
        "This command can only be ran when there is no active game in progress."
      );
      result.valid = false;
    }

    // We still need to see if the command is acting on
    // an actual key that exists as a room property.
    const constants = Object.keys(this.customSettings);
    if (!constants.map((e) => e.toLowerCase()).includes(constantToChange)) {
      result.valid = false;
      result.errors.push(
        `Room constant property ${constantToChange} doesn't exist. 
        (Available constants are ${constants.join(", ")})`
      );
    }

    return result;
  }

  setRoomConstant(targetKey: string, newValue: string) {}

  sendCommandResultToSocket(
    options: { [key: string]: any },
    message: string,
    command?: string
  ) {
    const scope =
      this.mode == GameMode.DefaultMultiplayer ? "default" : "custom";

    const systemMessageData = {
      name: "(System)",
      message: "",
      nameColor: "#06aa06",
      userID: ""
    };
    systemMessageData.message = message;
    options.sender.send(
      JSON.stringify({
        message: "addRoomChatMessage",
        scope: scope,
        data: systemMessageData
      })
    );
  }
}

function generateRoomID(length: number): string {
  const pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let current = "";
  while (
    current === "" ||
    utilities.checkIfPropertyWithValueExists(
      universal.rooms,
      "connectionID",
      current
    )
  ) {
    for (let i = 0; i < length; i++) {
      current += pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return current;
}

function processKeypressForRoom(
  connectionID: string,
  code: string,
  emulated?: boolean
) {
  const roomToProcess = utilities.findRoomWithConnectionID(connectionID, false);
  let inputInformation: InputActionInterface = {
    action: InputAction.Unknown,
    argument: ""
  };
  if (!roomToProcess) {
    return;
  }
  const gameDataToProcess = utilities.findGameDataWithConnectionID(
    connectionID,
    roomToProcess
  );
  if (!gameDataToProcess) {
    return;
  }
  // TODO: Refactor this.
  // find the type of room input
  inputInformation = input.getInputInformation(code);
  inputInformation.keyPressed = code;
  if (inputInformation.action !== InputAction.Unknown) {
    input.processInputInformation(inputInformation, gameDataToProcess);
  }
}

/**
 *
 * @param {universal.GameSocket} socket The socket that called the function. Will be used so function doesn't return self's data.
 * @param {Room} room The room the socket is in. TODO: Make it so that the room is inferred from the socket automatically.
 * @param {boolean} minifyData Whether to "minify" the data. This should be `true` if the data is expected to be sent to the client.
 * @returns
 */
function getOpponentsInformation(
  socket: universal.GameSocket,
  room: Room,
  minifyData: boolean
): any {
  const currentRoom = findRoomWithConnectionID(socket.connectionID);
  const aliveConnectionIDs: Array<string> = [];
  if (typeof currentRoom === "undefined" || currentRoom == null) {
    log.warn(`Room for owner ${socket.connectionID} of game data not found.`);
    return [];
  }
  const opponentGameData = currentRoom.gameData.filter(
    (element) => element.ownerConnectionID !== socket.connectionID
  );
  if (!minifyData) {
    return opponentGameData;
  }
  const minifiedOpponentGameData = [];
  for (let singleGameData of opponentGameData) {
    const minifiedGameData: MinifiedGameDataInterface = {
      baseHealth: singleGameData.baseHealth,
      combo: singleGameData.combo,
      currentInput: singleGameData.currentInput,
      receivedEnemiesStock: singleGameData.receivedEnemiesStock,
      owner: singleGameData.ownerConnectionID,
      ownerName: singleGameData.ownerName,
      enemies: singleGameData.enemies,
      enemiesToErase: singleGameData.enemiesToErase
    };

    minifiedOpponentGameData.push(minifiedGameData);
    aliveConnectionIDs.push(singleGameData.ownerConnectionID);
  }
  // 0 base health players
  const eliminatedConnectionIDs = room.connectionIDsThisRound.filter(
    (element) =>
      !aliveConnectionIDs.includes(element) && element !== socket.connectionID
  );
  // console.log(eliminatedConnectionIDs);
  for (let eliminated of eliminatedConnectionIDs) {
    const minifiedGameData: MinifiedGameDataInterface = {
      owner: eliminated,
      baseHealth: -99999
    };
    minifiedOpponentGameData.push(minifiedGameData);
  }
  return minifiedOpponentGameData;
}

/**
 * Sets the `defaultMultiplayerRoomID` variable for tracking of default multiplayer room.
 * @param {string} newID The string to set the ID to.
 */
function setDefaultMultiplayerRoomID(newID: string) {
  defaultMultiplayerRoomID = newID;
}

/**
 * Resets the Default Multiplayer Room's ID.
 * @param {room} room ???
 */
function resetDefaultMultiplayerRoomID(room: string) {
  defaultMultiplayerRoomID = null;
  log.info(`Reset default multiplayer room ID from ${room} to null.`);
}

export {
  Room,
  processKeypressForRoom,
  GameMode,
  defaultMultiplayerRoomID,
  resetDefaultMultiplayerRoomID,
  setDefaultMultiplayerRoomID,
  getOpponentsInformation
};
