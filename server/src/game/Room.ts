import * as utilities from "../core/utilities";
import * as universal from "../universal";
import * as _ from "lodash";
import { log } from "../core/log";
import * as input from "../core/input";
import { InputAction } from "../core/input";
import { findRoomWithConnectionID } from "../core/utilities";
import { GameData, GameMode, CustomGameSettings } from "./GameData";
import { GameActionRecord } from "../replay/recording/ActionRecord";

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

    // special for default multiplayer
    // check if default multiplayer room already exists
    if (gameMode === GameMode.DefaultMultiplayer && defaultMultiplayerRoomID) {
      log.warn(`There may only be one Default Multiplayer room at at time.`);
      log.warn(`There is one, which is ID ${defaultMultiplayerRoomID}.`);
      this.destroy();
      return;
    } else if (gameMode === GameMode.DefaultMultiplayer) {
      defaultMultiplayerRoomID = this.id;
    }

    log.info(`Created ${gameMode} room with ID ${this.id}`);
  }

  update(deltaTime: number) {
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
  addChatMessage(
    message: string,
    sender: universal.GameSocket | null,
    isSystemMessage?: boolean
  ) {
    if (!isSystemMessage && (!sender || !sender.connectionID)) {
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

    if (isSystemMessage) {
      messageToSend.sanitizedMessage = DOMPurify.sanitize(message);
      messageToSend.senderName = "(System)";
      messageToSend.nameColor = "#06aa06";
      messageToSend.userID = "";
    } else if (sender) {
      messageToSend.sanitizedMessage = DOMPurify.sanitize(message);
      messageToSend.senderName =
        universal.getNameFromConnectionID(sender.connectionID || "") || "";
      messageToSend.nameColor = sender.playerRank?.color ?? "#ffffff";
      messageToSend.userID = sender.ownerUserID ?? "";
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
    let minifiedGameData: { [key: string]: any } = {};
    minifiedGameData.baseHealth = singleGameData.baseHealth;
    minifiedGameData.combo = singleGameData.combo;
    minifiedGameData.currentInput = singleGameData.currentInput;
    minifiedGameData.receivedEnemiesStock = singleGameData.receivedEnemiesStock;
    minifiedGameData.owner = singleGameData.ownerConnectionID;
    minifiedGameData.ownerName = singleGameData.ownerName;
    minifiedGameData.enemies = singleGameData.enemies;
    minifiedGameData.enemiesToErase = singleGameData.enemiesToErase;
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
    let minifiedGameData: { [key: string]: any } = {};
    minifiedGameData.owner = eliminated;
    minifiedGameData.baseHealth = -99999;
    minifiedOpponentGameData.push(minifiedGameData);
  }
  return minifiedOpponentGameData;
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
  getOpponentsInformation
};
