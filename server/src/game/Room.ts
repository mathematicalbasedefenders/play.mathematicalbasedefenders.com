import * as utilities from "../core/utilities";
import * as universal from "../universal";
import * as enemy from "./Enemy";
import * as _ from "lodash";
import { log } from "../core/log";
import * as input from "../core/input";
import { addToStatistics, submitSingleplayerGame } from "../services/score";
import { InputAction } from "../core/input";
import { findRoomWithConnectionID, sleep } from "../core/utilities";
import { User } from "../models/User";
import {
  getSocketFromConnectionID,
  synchronizeGameDataWithSocket
} from "../universal";
import {
  GameData,
  SingleplayerGameData,
  CustomSingleplayerGameData,
  MultiplayerGameData,
  GameMode,
  ClockInterface,
  CustomGameSettings
} from "./GameData";
import { updateSingleplayerRoomData } from "./actions/update";
import {
  changeClientSideHTML,
  changeClientSideText
} from "./actions/send-html";
import {
  checkGlobalMultiplayerRoomClocks,
  checkPlayerMultiplayerRoomClocks
} from "./actions/clocks";
import { createGameOverScreenText } from "./actions/create-text";
import { performAnticheatCheck } from "../anticheat/anticheat";
import { createNewEnemy } from "./Enemy";
import { GameActionRecord } from "../replay/recording/ActionRecord";
const DEFAULT_MULTIPLAYER_INTERMISSION_TIME = 1000 * 10;
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
  addChatMessage(message: string, sender: universal.GameSocket) {
    if (!sender || !sender.connectionID) {
      log.warn(
        `No sender/connectionID for message: ${message} in room, ignoring.`
      );
      return;
    }

    const sanitizedMessage = DOMPurify.sanitize(message);
    const senderName = universal.getNameFromConnectionID(sender.connectionID);
    const nameColor = sender.playerRank?.color;
    const userID = sender.ownerUserID ?? null;
    this.chatMessages.push({
      message: sanitizedMessage,
      senderName: senderName
    });
    // send to all sockets
    for (const connectionID of this.memberConnectionIDs) {
      const socket = universal.getSocketFromConnectionID(connectionID);
      if (socket) {
        socket.send(
          JSON.stringify({
            message: "addRoomChatMessage",
            // selector:
            //   "#main-content__multiplayer-intermission-screen-container__chat__messages",
            data: {
              name: DOMPurify.sanitize(senderName),
              message: DOMPurify.sanitize(message),
              nameColor: nameColor,
              userID: userID
            }
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
    let members = _.clone(this.memberConnectionIDs);
    let spectators = _.clone(this.spectatorConnectionIDs);
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

class SingleplayerRoom extends Room {
  constructor(host: universal.GameSocket, mode: GameMode, settings?: any) {
    super(host, mode);
    // custom settings
    if (typeof settings !== "undefined") {
      setCustomRules(this, settings);
    }
  }

  startPlay() {
    if (
      this.mode === GameMode.EasySingleplayer ||
      this.mode === GameMode.StandardSingleplayer
    ) {
      for (let member of this.memberConnectionIDs) {
        const socket = getSocketFromConnectionID(member);
        if (socket) {
          this.gameData.push(new SingleplayerGameData(socket, this.mode));
        }
      }
    } else if (this.mode === GameMode.CustomSingleplayer) {
      for (let member of this.memberConnectionIDs) {
        const socket = getSocketFromConnectionID(member);
        if (socket) {
          this.gameData.push(
            new CustomSingleplayerGameData(
              socket,
              this.mode,
              this.customSettings
            )
          );
        }
      }
    }
    this.updating = true;
    this.gameActionRecord.initialize();
    log.info(`Room ${this.id} has started play!`);
  }

  async startGameOverProcess(data: GameData) {
    // destroy room
    this.playing = false;

    let socket = universal.getSocketFromConnectionID(data.ownerConnectionID);

    // game over here

    let gameMode: string = "";
    switch (data.mode) {
      case GameMode.EasySingleplayer: {
        gameMode = "Easy Singleplayer";
        break;
      }
      case GameMode.StandardSingleplayer: {
        gameMode = "Standard Singleplayer";
        break;
      }
      case GameMode.CustomSingleplayer: {
        gameMode = "Custom Singleplayer";
        break;
      }
    }

    data.commands.updateText = createGameOverScreenText(data, gameMode);
    data.commands.changeScreenTo = [{ value: "gameOver", age: 0 }];
    if (socket) {
      synchronizeGameDataWithSocket(socket);
    }

    // check anticheat and submit score
    if (socket) {
      if (true) {
        submitSingleplayerGame(data, socket);
      } else {
        log.warn("Anticheat may have detected cheating.");
      }
    }

    if (socket) {
      socket?.unsubscribe(this.id);
      this.deleteMember(socket);
    }
  }

  update() {
    const now: number = Date.now();
    const deltaTime: number = now - this.lastUpdateTime;
    // Check if room is supposed to update.
    if (!this.updating) {
      return;
    }

    /**
     * Call the `update` method for all types of rooms first.
     */
    super.update(deltaTime);
    this.lastUpdateTime = now;

    /**
     * Then call the `update` method made for Singleplayer rooms.
     */
    let data = this.gameData[0];
    if (data.aborted) {
      this.abort(data);
    }

    updateSingleplayerRoomData(this, deltaTime);
  }

  abort(data: GameData) {
    let socket = universal.getSocketFromConnectionID(data.ownerConnectionID);
    this.playing = false;
    data.commands.changeScreenTo = [{ value: "mainMenu", age: 0 }];
    if (socket) {
      socket?.unsubscribe(this.id);
      this.deleteMember(socket);
    }
  }
}

class MultiplayerRoom extends Room {
  nextGameStartTime!: Date | null;
  globalEnemySpawnThreshold: number;
  globalClock: ClockInterface;
  playersAtStart!: number;
  globalEnemyToAdd!: enemy.Enemy | null;
  constructor(host: universal.GameSocket, mode: GameMode, noHost: boolean) {
    super(host, mode, noHost);
    this.nextGameStartTime = null;
    this.globalEnemySpawnThreshold = 0.1;
    this.globalClock = {
      enemySpawn: {
        currentTime: 0,
        actionTime: 100
      },
      forcedEnemySpawn: {
        currentTime: 0,
        actionTime: 2500
      }
    };
  }

  startPlay() {
    for (let member of this.memberConnectionIDs) {
      const socket = universal.getSocketFromConnectionID(member);
      if (socket) {
        this.gameData.push(new MultiplayerGameData(socket, this.mode));
      }
    }
    this.ranking = [];
    this.connectionIDsThisRound = _.clone(this.memberConnectionIDs);
    this.playing = true;
    log.info(`Room ${this.id} has started play!`);
  }

  update() {
    // Update for all types of rooms
    let now: number = Date.now();
    let deltaTime: number = now - this.lastUpdateTime;
    super.update(deltaTime);
    this.lastUpdateTime = now;

    // other global stuff
    for (const connectionID of this.memberConnectionIDs) {
      const socket = universal.getSocketFromConnectionID(connectionID);
      if (socket) {
        const rankingPayload = utilities.generateRankingPayload(
          _.clone(this.ranking)
        );
        const playersPayload = utilities.generatePlayerListPayload(
          this.memberConnectionIDs
        );
        const playerCountSelector =
          "#main-content__multiplayer-intermission-screen-container__player-count";
        const playerCountText = this.memberConnectionIDs.length.toString();
        changeClientSideText(socket, playerCountSelector, playerCountText);
        // changeClientSideHTML(socket, rankingSelector, rankingText);
        socket.send(
          JSON.stringify({
            message: "modifyMultiplayerRankContent",
            data: rankingPayload
          })
        );
        // changeClientSideHTML(socket, playersSelector, playersText);
        socket.send(
          JSON.stringify({
            message: "modifyPlayerListContent",
            data: playersPayload
          })
        );
      }
    }

    // Then update specifically for multiplayer rooms
    if (!this.playing) {
      // Check if there is at least 2 players - if so, start intermission countdown
      if (
        this.nextGameStartTime == null &&
        this.memberConnectionIDs.length >= 2
      ) {
        this.nextGameStartTime = new Date(
          Date.now() + DEFAULT_MULTIPLAYER_INTERMISSION_TIME
        );
      }
      // Check if there is less than 2 players - if so, stop intermission countdown
      if (
        this.nextGameStartTime instanceof Date &&
        this.memberConnectionIDs.length < 2
      ) {
        this.nextGameStartTime = null;
      }
      // Start game
      // TODO: Refactor this
      if (this.nextGameStartTime != null) {
        if (new Date() >= this.nextGameStartTime) {
          this.startPlay();
          this.playersAtStart = this.memberConnectionIDs.length;
          for (const connectionID of this.memberConnectionIDs) {
            let socket = universal.getSocketFromConnectionID(connectionID);
            if (socket) {
              socket.send(
                JSON.stringify({
                  message: "changeScreen",
                  newScreen: "canvas"
                })
              );
              // add games played
              let userID = socket.ownerUserID;
              if (typeof userID === "string") {
                if (!universal.STATUS.databaseAvailable) {
                  log.warn(
                    "Database is not available. Not running database operation."
                  );
                } else {
                  User.addGamesPlayedToUserID(userID, 1);
                  User.addMultiplayerGamesPlayedToUserID(userID, 1);
                }
              }
            }
          }
        }
      }
      // Update Text
      for (const connectionID of this.memberConnectionIDs) {
        const socket = universal.getSocketFromConnectionID(connectionID);
        if (socket) {
          const selector =
            "#main-content__multiplayer-intermission-screen-container__game-status-message";
          if (this.nextGameStartTime) {
            let timeLeft = Date.now() - this.nextGameStartTime.getTime();
            timeLeft = Math.abs(timeLeft / 1000);
            const value = `Game starting in ${timeLeft.toFixed(3)} seconds.`;
            changeClientSideText(socket, selector, value);
          } else if (this.memberConnectionIDs.length < 2) {
            const value = `Waiting for at least 2 players.`;
            changeClientSideText(socket, selector, value);
          }
        }
      }
    } else {
      // playing
      for (const connectionID of this.memberConnectionIDs) {
        const socket = universal.getSocketFromConnectionID(connectionID);
        if (socket) {
          const selector =
            "#main-content__multiplayer-intermission-screen-container__game-status-message";
          const value = `Current game in progress. (Remaining: ${this.gameData.length}/${this.playersAtStart})`;
          changeClientSideText(socket, selector, value);
        }
      }

      // global - applies to all players
      // global clocks
      this.globalClock.enemySpawn.currentTime += deltaTime;
      this.globalClock.forcedEnemySpawn.currentTime += deltaTime;
      checkGlobalMultiplayerRoomClocks(this);

      // specific to each player
      for (const data of this.gameData) {
        const opponentGameData = this.gameData.filter(
          (element) => element.ownerConnectionID !== data.ownerConnectionID
        );

        if (data.aborted) {
          this.abort(data);
        }

        for (const enemy of data.enemies) {
          const BASE_ENEMY_SPEED = 0.1;
          enemy.move(
            BASE_ENEMY_SPEED * data.enemySpeedCoefficient * (deltaTime / 1000)
          );
          if (enemy.sPosition <= 0) {
            enemy.remove(data, 10);
          }
        }
        if (data.baseHealth <= 0) {
          // player is eliminated.
          const socket = universal.getSocketFromConnectionID(
            data.ownerConnectionID
          );
          if (socket && !data.aborted) {
            socket.send(
              JSON.stringify({
                message: "changeScreen",
                newScreen: "multiplayerIntermission"
              })
            );
          }

          this.eliminateSocketID(data.ownerConnectionID, data);
        }

        // clocks
        checkPlayerMultiplayerRoomClocks(data, this);

        // forced enemy (when zero)
        if (data.enemies.length === 0) {
          const enemy = createNewEnemy(`F${data.enemiesSpawned}`);
          data.enemies.push(_.clone(enemy));
          data.enemiesSpawned++;
        }

        // generated enemy
        if (this.globalEnemyToAdd) {
          data.enemiesSpawned++;
          data.enemies.push(_.clone(this.globalEnemyToAdd as enemy.Enemy));
        }

        // received enemy
        if (data.receivedEnemiesToSpawn > 0) {
          data.receivedEnemiesToSpawn--;
          data.enemiesSpawned++;
          const attributes = {
            speed: 0.1 * data.enemySpeedCoefficient
          };
          data.enemies.push(
            enemy.createNewReceivedEnemy(`R${data.enemiesSpawned}`, attributes)
          );
        }

        if (data.enemiesSentStock > 0) {
          data.enemiesSentStock--;
          let targetedOpponentGameData = _.sample(opponentGameData);
          if (targetedOpponentGameData) {
            targetedOpponentGameData.receivedEnemiesStock += 1;
            targetedOpponentGameData.totalEnemiesReceived += 1;
          }
        }
      }
    }
  }

  eliminateSocketID(connectionID: string, gameData: GameData | object) {
    const socket = universal.getSocketFromConnectionID(connectionID);
    if (typeof socket === "undefined") {
      log.warn(
        `Socket ID ${connectionID} not found while eliminating it from multiplayer room, but deleting anyway.`
      );
    }
    const place = this.gameData.length;
    if (gameData instanceof GameData) {
      const data = {
        placement: place,
        name: universal.getNameFromConnectionID(connectionID) || "???",
        time: gameData.elapsedTime,
        sent: gameData.totalEnemiesSent,
        received: gameData.totalEnemiesReceived,
        isRegistered: false,
        nameColor: "",
        userID: ""
      };
      if (socket?.ownerUserID) {
        // is registered
        data.isRegistered = true;
        data.userID = socket.ownerUserID;
        data.nameColor = socket.playerRank?.color ?? "#ffffff";
      }
      this.ranking.push(data);
    }
    if (socket?.loggedIn && gameData instanceof GameData) {
      const earnedEXP = Math.round(gameData.elapsedTime / 2000);
      User.giveExperiencePointsToUserID(
        socket.ownerUserID as string,
        earnedEXP
      );
    }
    // eliminate the socket
    let gameDataIndex = this.gameData.findIndex(
      (element) => element.ownerConnectionID === connectionID
    );
    if (gameDataIndex > -1) {
      this.gameData.splice(gameDataIndex, 1);
    }
    log.info(
      `Socket ID ${connectionID} (${universal.getNameFromConnectionID(
        connectionID
      )}) has been eliminated from the Default Multiplayer Room`
    );
    // give exp to eliminated player
    // add to ranking
    this.checkIfGameFinished(this.gameData);
  }

  async checkIfGameFinished(gameDataArray: Array<GameData>) {
    if (gameDataArray.length <= 1) {
      // game finished
      // Default Multiplayer for now since there's only 1 multiplayer room at a given time.
      log.info(`Default Multiplayer Room has finished playing.`);
      if (gameDataArray.length === 1) {
        let winnerGameData = gameDataArray[0];
        log.info(
          `The winner is socket ID ${
            winnerGameData.ownerConnectionID
          } (${universal.getNameFromConnectionID(
            winnerGameData.ownerConnectionID
          )})`
        );
        const winnerSocket = universal.getSocketFromConnectionID(
          winnerGameData.ownerConnectionID
        );

        // add exp to winner socket
        if (winnerSocket?.ownerUserID) {
          if (typeof winnerSocket.ownerUserID === "string") {
            if (!universal.STATUS.databaseAvailable) {
              log.warn(
                "Database is not available. Not running database operation."
              );
            } else {
              // multiplayer games won
              User.addMultiplayerGamesWonToUserID(
                winnerSocket.ownerUserID as string,
                1
              );
              // experience (50% bonus for winning)
              const earnedEXP =
                Math.round(winnerGameData.elapsedTime / 2000) * 1.5;
              User.giveExperiencePointsToUserID(
                winnerSocket.ownerUserID as string,
                earnedEXP
              );
            }
          }
        }

        const data = {
          placement: this.gameData.length,
          name:
            universal.getNameFromConnectionID(
              winnerGameData.ownerConnectionID
            ) || "???",
          time: winnerGameData.elapsedTime,
          sent: winnerGameData.totalEnemiesSent,
          received: winnerGameData.totalEnemiesReceived,
          isRegistered: false,
          nameColor: "",
          userID: ""
        };
        if (winnerSocket?.ownerUserID) {
          // is registered
          data.isRegistered = true;
          data.userID = winnerSocket.ownerUserID;
          data.nameColor = winnerSocket.playerRank?.color ?? "#ffffff";
        }
        this.ranking.push(data);
      }
      // stop everyone from playing
      this.stopPlay();
      // bring everyone to intermission screen
      this.summonEveryoneToIntermission();
      // update everyone's client-side statistics
      const socketsInRoom = this.memberConnectionIDs.map((id) =>
        universal.getSocketFromConnectionID(id)
      );
      await sleep(1000);
      utilities.bulkUpdateSocketUserInformation(...socketsInRoom);
    }
  }

  // force quit - NOT send to intermission screen
  abort(data: GameData) {
    data.baseHealth = -99999;
    let socket = universal.getSocketFromConnectionID(data.ownerConnectionID);
    data.commands.changeScreenTo = [{ value: "mainMenu", age: 0 }];
    log.info(
      `Socket ID ${data.ownerConnectionID} (${universal.getNameFromConnectionID(
        data.ownerConnectionID
      )}) has quit the Default Multiplayer Room`
    );
    if (socket) {
      socket?.unsubscribe(this.id);
      this.deleteMember(socket);
    }
  }

  stopPlay() {
    this.playing = false;
    this.nextGameStartTime = new Date(
      Date.now() + DEFAULT_MULTIPLAYER_INTERMISSION_TIME
    );
    this.connectionIDsThisRound = [];
    this.gameData = [];
    // send everyone to intermission

    log.info(`Room ${this.id} has stopped play.`);
  }

  summonEveryoneToIntermission() {
    // TODO: Add spectators once they get implemented
    for (const connectionID of this.memberConnectionIDs) {
      let socket = universal.getSocketFromConnectionID(connectionID);
      if (typeof socket === "undefined") {
        log.warn(
          `Socket ID ${connectionID} not found while summoning it to lobby, therefore skipping process.`
        );
        continue;
      }
      socket.send(
        JSON.stringify({
          message: "changeScreen",
          newScreen: "multiplayerIntermission"
        })
      );
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

function processKeypressForRoom(
  connectionID: string,
  code: string,
  emulated?: boolean
) {
  let roomToProcess = utilities.findRoomWithConnectionID(connectionID, false);
  let inputInformation: InputActionInterface = {
    action: InputAction.Unknown,
    argument: ""
  };
  if (!roomToProcess) {
    return;
  }
  let gameDataToProcess = utilities.findGameDataWithConnectionID(
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
    input.processInputInformation(
      inputInformation,
      gameDataToProcess,
      emulated
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
  if (room instanceof MultiplayerRoom) {
    if (room.playing) {
      let gameData = utilities.findGameDataWithConnectionID(
        socket.connectionID as string
      );
      if (gameData) {
        room.abort(gameData);
      }
    }
    room.deleteMember(socket);
    socket.unsubscribe(defaultMultiplayerRoomID as string);
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
  let currentRoom: SingleplayerRoom | MultiplayerRoom | null =
    findRoomWithConnectionID(socket.connectionID);
  let aliveConnectionIDs: Array<string> = [];
  if (typeof currentRoom === "undefined" || currentRoom == null) {
    log.warn(`Room for owner ${socket.connectionID} of game data not found.`);
    return [];
  }
  let opponentGameData = currentRoom.gameData.filter(
    (element) => element.ownerConnectionID !== socket.connectionID
  );
  if (minifyData) {
    let minifiedOpponentGameData = [];
    for (let singleGameData of opponentGameData) {
      let minifiedGameData: { [key: string]: any } = {};
      minifiedGameData.baseHealth = singleGameData.baseHealth;
      minifiedGameData.combo = singleGameData.combo;
      minifiedGameData.currentInput = singleGameData.currentInput;
      minifiedGameData.receivedEnemiesStock =
        singleGameData.receivedEnemiesStock;
      minifiedGameData.owner = singleGameData.ownerConnectionID;
      minifiedGameData.ownerName = singleGameData.ownerName;
      minifiedGameData.enemies = singleGameData.enemies;
      minifiedGameData.enemiesToErase = singleGameData.enemiesToErase;
      minifiedOpponentGameData.push(minifiedGameData);
      aliveConnectionIDs.push(singleGameData.ownerConnectionID);
    }
    // 0 base health players
    let eliminatedConnectionIDs = room.connectionIDsThisRound.filter(
      (element) =>
        aliveConnectionIDs.indexOf(element) === -1 &&
        element !== socket.connectionID
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
  return opponentGameData;
}

/**
 * Resets the Default Multiplayer Room's ID.
 * @param {room} room ???
 */
function resetDefaultMultiplayerRoomID(room: string) {
  defaultMultiplayerRoomID = null;
  log.info(`Reset default multiplayer room ID from ${room} to null.`);
}

/**
 * Sets the custom rules to a room.
 * @param {Room} room The room to set settings to.
 * @param {any} settings The settings to set the room to.
 */
function setCustomRules(room: Room, settings: { [key: string]: any }) {
  room.customSettings = {
    baseHealth: 100,
    comboTime: 5000,
    enemySpeedCoefficient: 1,
    enemySpawnThreshold: 0.1,
    enemySpawnTime: 100,
    forcedEnemySpawnTime: 2500
  };
  room.customSettings.baseHealth = parseFloat(settings.baseHealth);
  room.customSettings.comboTime = parseFloat(settings.comboTime);
  room.customSettings.enemySpeedCoefficient = parseFloat(
    settings.enemySpeedCoefficient
  );
  room.customSettings.enemySpawnTime = parseFloat(settings.enemySpawnTime);
  room.customSettings.enemySpawnThreshold = parseFloat(
    settings.enemySpawnChance
  );
  room.customSettings.forcedEnemySpawnTime = parseFloat(
    settings.forcedEnemySpawnTime
  );
}

/**
 * Creates a new singleplayer room.
 * @param {universal.GameSocket} caller The socket that called the function
 * @param {GameMode} gameMode The singleplayer game mode.
 * @param {settings} settings The `settings` for the singleplayer game mode, if it's custom.
 * @returns The newly-created room object.
 */
function createSingleplayerRoom(
  caller: universal.GameSocket,
  gameMode: GameMode,
  settings?: { [key: string]: string }
): SingleplayerRoom {
  const room = new SingleplayerRoom(caller, gameMode, settings);
  universal.rooms.push(room);
  return room;
}

export {
  SingleplayerRoom,
  MultiplayerRoom,
  Room,
  processKeypressForRoom,
  GameMode,
  defaultMultiplayerRoomID,
  leaveMultiplayerRoom,
  resetDefaultMultiplayerRoomID,
  getOpponentsInformation,
  createSingleplayerRoom
};
