import * as utilities from "../../core/utilities";
import * as universal from "../../universal";
import * as _ from "lodash";
import * as input from "../../core/input";
import { log } from "../../core/log";
import { InputAction } from "../../core/input";
import { findRoomWithConnectionID, sleep } from "../../core/utilities";
import { GameData, GameMode } from "../GameData";

const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
let defaultMultiplayerRoomID: string | null = null;

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
  customSettings!: { [key: string]: any };

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

    // special for default multiplayer
    // check if default multiplayer room already exists
    if (gameMode === GameMode.DefaultMultiplayer && defaultMultiplayerRoomID) {
      log.warn(`There may only be one Default Multiplayer room at at time.`);
      log.warn(`There is one, which is ID ${defaultMultiplayerRoomID}.`);
      this.destroy();
      return;
    }

    if (gameMode === GameMode.DefaultMultiplayer) {
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

  addChatMessage(message: string, sender: string) {
    let sanitizedMessage = DOMPurify.sanitize(message);
    this.chatMessages.push({
      message: sanitizedMessage,
      sender: sender
    });
    // send to all sockets
    for (let connectionID of this.memberConnectionIDs) {
      let socket = universal.getSocketFromConnectionID(connectionID);
      if (socket) {
        socket.send(
          JSON.stringify({
            message: "appendHTML",
            selector:
              "#main-content__multiplayer-intermission-screen-container__chat__messages",
            value: `<div>${sender}: ${message}</div>`
          })
        );
      }
    }
  }

  /**
   * Adds the socket to this `Room` instance as a member.
   * @param {universal.GameSocket} caller The socket to add to the room (also the socket who called this function)
   */
  addMember(caller: universal.GameSocket) {
    const connectionID = caller.connectionID as string;
    if (
      this.memberConnectionIDs.indexOf(connectionID) === -1 &&
      this.spectatorConnectionIDs.indexOf(connectionID) === -1
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
      this.spectatorConnectionIDs.indexOf(connectionID) === -1 &&
      this.memberConnectionIDs.indexOf(connectionID) === -1
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
    if (this.memberConnectionIDs.indexOf(connectionID) > -1) {
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
    if (this.spectatorConnectionIDs.indexOf(connectionID) > -1) {
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
  }

  processKeypress(connectionID: string, code: string) {
    // get game data
    const gameData = utilities.findGameDataWithConnectionID(connectionID, this);
    if (!gameData) {
      log.warn(`No game data associated with ID ${connectionID} found.`);
      return;
    }

    // find the type of room input
    const inputInformation = input.getInputInformation(code);
    if (inputInformation.action !== InputAction.Unknown) {
      input.processInputInformation(inputInformation, gameData);
    }
  }
}

function generateRoomID(length: number): string {
  let pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
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

// This just attempts to leave.
function leaveMultiplayerRoom(socket: universal.GameSocket) {
  // TODO: Implement for spectators when spectators are implemented.
  let room = universal.rooms.find(
    (element) =>
      element.memberConnectionIDs.indexOf(socket.connectionID as string) > -1
  );
  // if (room instanceof MultiplayerRoom) {
  //   if (room.playing) {
  //     let gameData = utilities.findGameDataWithConnectionID(
  //       socket.connectionID as string
  //     );
  //     if (gameData) {
  //       room.abort(gameData);
  //     }
  //   }
  //   room.deleteMember(socket);
  //   socket.unsubscribe(defaultMultiplayerRoomID as string);
  // }
  if (!room) {
    log.warn(`Unable to leave multiplayer room for socket ID ${socket.id}.`);
    log.warn(`Hopefully, this is just because the socket isn't in any room.`);
    return;
  }
  room.deleteMember(socket);
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
  GameMode,
  defaultMultiplayerRoomID,
  leaveMultiplayerRoom,
  resetDefaultMultiplayerRoomID
};
