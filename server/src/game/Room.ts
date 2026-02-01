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
  GAME_DATA_CONSTANTS
} from "./GameData";
import { GameActionRecord } from "../replay/recording/ActionRecord";
import { Enemy } from "./Enemy";
import { MultiplayerRoom } from "./MultiplayerRoom";
import { UserData } from "../universal";

const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
let defaultMultiplayerRoomID: string | null = null;

const COMMAND_DATA = [
  "start",
  "set",
  "get",
  "setvisibility",
  "getvisibility",
  "kick",
  "transferhost"
];

interface InputActionInterface {
  action: InputAction;
  argument: string;
  keyPressed?: string;
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
  host: universal.GameWebSocket<UserData> | null;
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

  // custom multiplayer
  hidden: boolean = false;

  /**
   * Creates a `Room` instance. This shouldn't be called directly.
   * Instead it should be called from a `super()` call from either
   * a new `SingleplayerRoom` or a new `MultiplayerRoom`.
   * Note: A Room will only "start to function" when it is in `universal.rooms`.
   * @param {universal.GameWebSocket<UserData>} host The socket that asked for the room.
   * @param {GameMode} gameMode The game mode of the room
   * @param {boolean} noHost Should only be `true` on Default Multiplayer.
   * @returns
   */
  constructor(
    host: universal.GameWebSocket<UserData>,
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

    this.customSettings = {
      baseHealth: GAME_DATA_CONSTANTS.INITIAL_BASE_HEALTH,
      comboTime: GAME_DATA_CONSTANTS.CUSTOM_MULTIPLAYER_INITIAL_COMBO_TIME,
      enemySpeedCoefficient:
        GAME_DATA_CONSTANTS.CUSTOM_MULTIPLAYER_INITIAL_ENEMY_SPEED_COEFFICIENT,
      enemySpawnThreshold:
        GAME_DATA_CONSTANTS.CUSTOM_MULTIPLAYER_INITIAL_ENEMY_SPAWN_THRESHOLD,
      enemySpawnTime:
        GAME_DATA_CONSTANTS.CUSTOM_MULTIPLAYER_INITIAL_ENEMY_SPAWN_TIME,
      forcedEnemySpawnTime:
        GAME_DATA_CONSTANTS.CUSTOM_MULTIPLAYER_INITIAL_FORCED_ENEMY_SPAWN_TIME
    };

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
      (!options.sender || !options.sender.getUserData().connectionID)
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
        universal.getNameFromConnectionID(
          options.sender.getUserData().connectionID || ""
        ) || "";
      messageToSend.nameColor =
        options.sender.getUserData().playerRank?.color ?? "#ffffff";
      messageToSend.userID = options.sender.getUserData().ownerUserID ?? "";
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

    if (
      options?.sender.getUserData().connectionID ===
      this.host?.getUserData().connectionID
    ) {
      isHost = true;
    }

    // substring constant because we already know
    // index 0 in `message` is the `/`, which signifies
    // a chat command.
    const text = message.substring(1).split(" ");
    const [command, ...context] = text;

    const senderName =
      universal.getNameFromConnectionID(
        options.sender.getUserData().connectionID || ""
      ) || "";

    switch (command) {
      case "start": {
        const result = this.validateStartCommandForRoom(isHost);

        if (!result.valid) {
          let commandErrorMessage = `Unable to run /start due to the following reason(s): `;
          commandErrorMessage += result.errors.join(" ");
          this.sendCommandResultToSocket(commandErrorMessage, options);
          break;
        }

        // give feedback
        // TODO: Add a delay for everyone to see when it's time to start.
        const commandSuccessMessage = `Successfully ran command /${command}. Game will now start.`;
        this.sendCommandResultToSocket(commandSuccessMessage, options);

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
          let commandErrorMessage = `Unable to run /set due to the following reason(s): `;
          commandErrorMessage += result.errors.join(" ");
          this.sendCommandResultToSocket(commandErrorMessage, options);
          break;
        }
        this.setRoomConstant(context[0], context[1]);
        const selfMessage = `Successfully set room's constant property ${result.target} to ${context[1]}.`;
        this.sendCommandResultToSocket(selfMessage, options);
        const roomMessage = `The room's host has set this room's constant property ${result.target} to ${context[1]}.`;
        this.addChatMessage(roomMessage, { isSystemMessage: true });
        break;
      }
      case "get": {
        if (context.length == 0) {
          // no context wanted, show all.
          let message = "The constant properties' values for this room are: ";
          let values: Array<string> = [];
          for (const constant of Object.keys(this.customSettings)) {
            values.push(`${constant}: ${this.customSettings[constant]}`);
          }
          message += values.join(", ");
          message += ".";
          this.sendCommandResultToSocket(message, options);
          break;
        }

        // context found, show the context
        let target = "";
        let found = false;
        const constants = Object.keys(this.customSettings);
        for (const constant of constants) {
          const lowercased = constant.toLowerCase();
          if (lowercased === context[0].toLowerCase()) {
            target = constant;
            found = true;
            break;
          }
        }
        if (!found) {
          const message = `Unknown room custom property: ${context[0]}`;
          this.sendCommandResultToSocket(message, options);
          break;
        }
        const value = this.customSettings[target];
        const message = `The constant property ${target}'s value for this room is ${value}.`;
        this.sendCommandResultToSocket(message, options);
        break;
      }
      case "setvisibility": {
        const result = this.validateSetVisibilityCommandForRoom(
          isHost,
          context
        );
        if (!result.valid) {
          let commandErrorMessage = `Unable to run /setvisibility due to the following reason(s): `;
          commandErrorMessage += result.errors.join(" ");
          this.sendCommandResultToSocket(commandErrorMessage, options);
          break;
        }

        // valid
        if (context[0] === "true") {
          const selfMessage = `Successfully set room's visibility to true.`;
          this.sendCommandResultToSocket(selfMessage, options);
          const roomMessage = `The room's host has set this visibility to true.`;
          this.addChatMessage(roomMessage, { isSystemMessage: true });
          this.setRoomVisibility(true);
        } else if (context[0] === "false") {
          const selfMessage = `Successfully set room's visibility to false.`;
          this.sendCommandResultToSocket(selfMessage, options);
          const roomMessage = `The room's host has set this room's visibility to false.`;
          this.addChatMessage(roomMessage, { isSystemMessage: true });
          this.setRoomVisibility(false);
        }

        break;
      }
      case "getvisibility": {
        let message = "";
        if (this.hidden) {
          message =
            "This room is hidden. It is not shown in the room list, but other players may still join through the room code.";
        } else {
          message =
            "This room is public. It is shown in the room list, and other players can also join through the room code.";
        }
        this.sendCommandResultToSocket(message, options);
        break;
      }
      case "kick": {
        const result = this.validateKickCommandForRoom(
          isHost,
          context,
          senderName
        );
        if (!result.valid) {
          let commandErrorMessage = `Unable to run /kick due to the following reason(s): `;
          commandErrorMessage += result.errors.join(" ");
          this.sendCommandResultToSocket(commandErrorMessage, options);
          break;
        }

        const nameToKick = context.join(" ");
        const connectionIDToKick = this.memberConnectionIDs.find(
          (e) => universal.getNameFromConnectionID(e) === nameToKick
        );
        const connectionIDOfSender = this.memberConnectionIDs.find(
          (e) => universal.getNameFromConnectionID(e) === senderName
        );

        // defaults to `???`, since there are no sockets
        // which this connectionID already in the first place.
        const socketToKick = universal.getSocketFromConnectionID(
          connectionIDToKick ?? "???"
        );

        const senderSocket = universal.getSocketFromConnectionID(
          connectionIDOfSender ?? "???"
        );

        if (senderSocket && socketToKick) {
          this.kickMember(senderSocket, socketToKick);
          const selfMessage = `Successfully kicked ${nameToKick} from the room.`;
          this.sendCommandResultToSocket(selfMessage, options);
          const roomMessage = `The room's host has kicked ${nameToKick} from the room.`;
          this.addChatMessage(roomMessage, { isSystemMessage: true });
        } else {
          log.warn(`Unable to to kick ${nameToKick} from room ${this.id}.`);
          const selfMessage = `Unable to kick ${nameToKick} from the room. Please contact the server administrator if this happens again!`;
          this.sendCommandResultToSocket(selfMessage, options);
        }

        log.info(
          `Host of room ${this.id} has kicked ${nameToKick} from the room.`
        );
        break;
      }
      case "transferhost": {
        const result = this.validateTransferHostCommandForRoom(
          isHost,
          context,
          senderName
        );
        if (!result.valid) {
          let commandErrorMessage = `Unable to run /transferhost due to the following reason(s): `;
          commandErrorMessage += result.errors.join(" ");
          this.sendCommandResultToSocket(commandErrorMessage, options);
          break;
        }

        const nameToTransferHostTo = context.join(" ");
        const connectionIDToTransferHostTo = this.memberConnectionIDs.find(
          (e) => universal.getNameFromConnectionID(e) === nameToTransferHostTo
        );
        const connectionIDOfSender = this.memberConnectionIDs.find(
          (e) => universal.getNameFromConnectionID(e) === senderName
        );

        // defaults to `???`, since there are no sockets
        // which this connectionID already in the first place.
        const newHostSocket = universal.getSocketFromConnectionID(
          connectionIDToTransferHostTo ?? "???"
        );

        const senderSocket = universal.getSocketFromConnectionID(
          connectionIDOfSender ?? "???"
        );

        if (senderSocket && newHostSocket) {
          (this as unknown as MultiplayerRoom).setNewHost(
            connectionIDToTransferHostTo as string
          );
          const selfMessage = `Successfully transferred hosting powers to ${nameToTransferHostTo}.`;
          this.sendCommandResultToSocket(selfMessage, options);
          const roomMessage = `The host of this room has transferred hosting powers to ${nameToTransferHostTo}.`;
          this.addChatMessage(roomMessage, { isSystemMessage: true });
          const newHostMessage = `The host of this room has transferred hosting powers to you. You are now the host of this room.`;
          this.sendCommandResultToSocket(newHostMessage, {
            sender: newHostSocket
          });
        } else {
          log.warn(
            `Unable to to transfer host to ${nameToTransferHostTo} for room ${this.id}.`
          );
          const selfMessage = `Unable to to transfer host to ${nameToTransferHostTo} for room ${this.id}. Please contact the server administrator if this happens again!`;
          this.sendCommandResultToSocket(selfMessage, options);
        }

        log.info(
          `Host of room ${this.id} has transferred hosting powers to ${nameToTransferHostTo} for room ${this.id}.`
        );
        break;
      }
      case "?":
      case "help": {
        let message = `The available commands are: `;
        message += COMMAND_DATA.map((e) => "/" + e).join(", ");
        message += ".";
        if (!isHost) {
          message += " ";
          message +=
            "Note that you may not use some of these commands as they are reserved for the host.";
        }
        this.sendCommandResultToSocket(message, options);
        break;
      }
      default: {
        const message = `Unknown command /${command}.`;
        this.sendCommandResultToSocket(message, options);
        break;
      }
    }

    // log the command
    log.info(`${senderName} sent message ${message} to Room ID ${this.id}`);
  }

  /**
   * Adds the socket to this `Room` instance as a member.
   * @param {universal.GameWebSocket<UserData>} caller The socket to add to the room (also the socket who called this function)
   */
  addMember(caller: universal.GameWebSocket<UserData>) {
    const connectionID = caller.getUserData().connectionID as string;
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
   * @param {universal.GameWebSocket<UserData>} caller The socket to add to the room (also the socket who called this function)
   */
  addSpectator(caller: universal.GameWebSocket<UserData>) {
    const connectionID = caller.getUserData().connectionID as string;
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
   * @param {universal.GameWebSocket<UserData>} caller The socket to delete from the room (also the socket who called this function)
   */
  deleteMember(caller: universal.GameWebSocket<UserData>) {
    const connectionID = caller.getUserData().connectionID as string;
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

  kickMember(
    caller: universal.GameWebSocket<UserData>,
    target: universal.GameWebSocket<UserData>
  ) {
    const callerConnectionID = caller.getUserData().connectionID as string;
    const targetConnectionID = target.getUserData().connectionID as string;
    if (
      !this.memberConnectionIDs.includes(callerConnectionID) ||
      !this.memberConnectionIDs.includes(targetConnectionID)
    ) {
      log.warn(`Unable to kick: Member/target doesn't exist in ${this.id}`);
      return;
    }

    // kick here
    this.memberConnectionIDs.splice(
      this.memberConnectionIDs.indexOf(targetConnectionID),
      1
    );
    const targetSocket =
      universal.getSocketFromConnectionID(targetConnectionID);

    if (targetSocket) {
      targetSocket.unsubscribe(this.id);
      this.deleteMember(targetSocket);

      const message = `You have been kicked from this Custom Multiplayer room!`;
      const BORDER_COLOR = `#ff0000`;
      universal.sendToastMessageToSocket(targetSocket, message, BORDER_COLOR);
      targetSocket.send(
        JSON.stringify({
          message: "changeScreen",
          newScreen: "mainMenu"
        })
      );
    }

    log.info(
      `Socket with ID ${callerConnectionID} kicked socket with ID ${targetConnectionID} (member) from room ${this.id}`
    );
  }

  /**
   * Deletes the socket from this `Room` instance.
   * This requires that the socket is a spectator (and not a member),
   * @param {universal.GameWebSocket<UserData>} caller The socket to delete from the room (also the socket who called this function)
   */
  deleteSpectator(caller: universal.GameWebSocket<UserData>) {
    const connectionID = caller.getUserData().connectionID as string;
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
        this.deleteSpectator(socket);
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
      errors.push("You must be the room's host to run this command.");
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
    const result: { valid: boolean; errors: Array<string>; target: string } = {
      valid: true,
      errors: [],
      target: ""
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

    const constantToChange = context[0];
    const newValueAsString = context[1];

    // Early stop for the same reason above.
    // TODO: For now, all values are integers, so some expansion
    // is needed when the values can be (e.g.) string enums.
    if (!utilities.IS_NUMBER_REGEX.test(newValueAsString)) {
      result.valid = false;
      result.errors.push(`New value is not a number.`);
      return result;
    }

    // One finally early stop.
    if (!this.customSettings) {
      result.valid = false;
      result.errors.push(
        `This room does not contain custom settings. Please contact the server administrator!`
      );
      return result;
    }

    // At this point, the command's form is considered to be "correct",
    // However, further checks on the CONTEXT of the command's runner and the room
    // is required, just like how the host can only issue commands on non-active games.
    if (!isHost) {
      result.errors.push("You must be the room's host to run this command.");
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
    const lowercasedTarget = constantToChange.toLowerCase();
    if (!constants.map((e) => e.toLowerCase()).includes(lowercasedTarget)) {
      result.valid = false;
      result.errors.push(
        `Room constant property ${constantToChange} doesn't exist. 
        (Available constants are ${constants.join(", ")})`
      );
      return result;
    }

    // We also need to check that the value is in the allowed range.
    let target = "";
    for (const constant of constants) {
      const lowercased = constant.toLowerCase();
      if (lowercased === constantToChange.toLowerCase()) {
        target = constant;
        result.target = constant;
        break;
      }
    }
    const newSettings = _.clone(this.customSettings);
    newSettings[target] = parseFloat(newValueAsString);
    const setResult = utilities.validateCustomGameSettings(
      "multiplayer",
      newSettings
    );

    if (!setResult.success) {
      result.valid = false;
      const valueErrorMessage =
        setResult.reason ?? `Unknown error on constant property ${target}`;
      result.errors.push(valueErrorMessage);
    }

    return result;
  }

  validateSetVisibilityCommandForRoom(isHost: boolean, context: Array<string>) {
    const result: { valid: boolean; errors: Array<string> } = {
      valid: true,
      errors: []
    };

    if (!isHost) {
      result.errors.push("You must be the room's host to run this command.");
      result.valid = false;
    }

    if (!(this.mode === GameMode.CustomMultiplayer)) {
      result.errors.push(
        "This command must be ran in a Custom Multiplayer room."
      );
      result.valid = false;
    }

    if (!(context[0] === "true" || context[0] === "false")) {
      result.errors.push(
        `This command's argument can only be either "true" or "false".`
      );
      result.valid = false;
    }
    return result;
  }

  validateKickCommandForRoom(
    isHost: boolean,
    context: Array<string>,
    senderName: string
  ) {
    const result: { valid: boolean; errors: Array<string> } = {
      valid: true,
      errors: []
    };

    if (!isHost) {
      result.errors.push("You must be the room's host to run this command.");
      result.valid = false;
    }

    if (!(this.mode === GameMode.CustomMultiplayer)) {
      result.errors.push(
        "This command must be ran in a Custom Multiplayer room."
      );
      result.valid = false;
    }

    const target = context.join(" ");
    const names = this.memberConnectionIDs.map((connectionID) => {
      return universal.getNameFromConnectionID(connectionID);
    });

    if (target === "") {
      result.errors.push(`No player to kick is specified.`);
      result.valid = false;
    } else if (!names.includes(target)) {
      result.errors.push(`Player ${target} doesn't exist in this room.`);
      result.valid = false;
    }

    if (target === senderName) {
      result.errors.push(`You can't kick yourself.`);
      result.valid = false;
    }
    return result;
  }

  validateTransferHostCommandForRoom(
    isHost: boolean,
    context: Array<string>,
    senderName: string
  ) {
    const result: { valid: boolean; errors: Array<string> } = {
      valid: true,
      errors: []
    };

    if (!isHost) {
      result.errors.push("You must be the room's host to run this command.");
      result.valid = false;
    }

    if (!(this.mode === GameMode.CustomMultiplayer)) {
      result.errors.push(
        "This command must be ran in a Custom Multiplayer room."
      );
      result.valid = false;
    }

    const target = context.join(" ");
    const names = this.memberConnectionIDs.map((connectionID) => {
      return universal.getNameFromConnectionID(connectionID);
    });

    if (target === "") {
      result.errors.push(`No player to give hosting powers to is specified.`);
      result.valid = false;
    } else if (!names.includes(target)) {
      result.errors.push(`Player ${target} doesn't exist in this room.`);
      result.valid = false;
    }

    if (target === senderName) {
      result.errors.push(`You are already the host of this room!`);
      result.valid = false;
    }
    return result;
  }

  setRoomConstant(targetKey: string, newValueAsString: string) {
    // TODO: DRY
    let target = "";
    const constants = Object.keys(this.customSettings);
    for (const constant of constants) {
      const lowercased = constant.toLowerCase();
      if (lowercased === targetKey.toLowerCase()) {
        target = constant;
        break;
      }
    }
    const newValue = parseFloat(newValueAsString);
    this.customSettings[target] = newValue;
  }

  setRoomVisibility(visible: boolean) {
    this.hidden = !visible;
  }

  sendCommandResultToSocket(message: string, options: { [key: string]: any }) {
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

  /**
   * Updates clock data so that replays can be accurate.
   * @param {GameData} gameDataToProcess
   * @param {room} room
   */
  updateReplayClockData(gameDataToProcess: GameData, room: Room) {
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
 * @param {universal.GameWebSocket<UserData>} socket The socket that called the function. Will be used so function doesn't return self's data.
 * @param {Room} room The room the socket is in. TODO: Make it so that the room is inferred from the socket automatically.
 * @param {boolean} minifyData Whether to "minify" the data. This should be `true` if the data is expected to be sent to the client.
 * @returns
 */
function getOpponentsInformation(
  socket: universal.GameWebSocket<UserData>,
  room: Room,
  minifyData: boolean
): any {
  const socketUserData = socket.getUserData();
  const currentRoom = findRoomWithConnectionID(socketUserData.connectionID);
  const aliveConnectionIDs: Array<string> = [];
  if (typeof currentRoom === "undefined" || currentRoom == null) {
    log.warn(
      `Room for owner ${socketUserData.connectionID} of game data not found.`
    );
    return [];
  }
  const opponentGameData = currentRoom.gameData.filter(
    (element) => element.ownerConnectionID !== socketUserData.connectionID
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
      !aliveConnectionIDs.includes(element) &&
      element !== socketUserData.connectionID
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
