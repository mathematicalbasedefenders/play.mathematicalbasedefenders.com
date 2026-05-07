import _ from "lodash";
import { log } from "../core/log";
import {
  getUserReplayDataFromSocket,
  convertGameSettingsToReplayActions,
  findRoomWithConnectionID,
  sleep
} from "../core/utilities";
import { Action, ActionRecord } from "../replay/recording/ActionRecord";
import {
  checkGlobalMultiplayerRoomClocks,
  checkPlayerMultiplayerRoomClocks
} from "./actions/clocks";
import { changeClientSideText } from "./actions/send-html";
import { createNewEnemy, getEnemyAttributesBasedOnGameData } from "./Enemy";
import {
  ClockInterface,
  GameMode,
  MultiplayerGameData,
  GameData,
  GAME_DATA_CONSTANTS
} from "./GameData";
import { Room } from "./Room";
import * as universal from "../universal";
import * as utilities from "../core/utilities";
import { Enemy } from "./Enemy";
import * as enemy from "./Enemy";
import { UserData } from "../universal";

const PLAYER_LIST_UPDATE_INTERVAL = 1000;

const COMMAND_DATA = [
  "start",
  "set",
  "get",
  "setvisibility",
  "getvisibility",
  "kick",
  "transferhost"
];

class MultiplayerRoom extends Room {
  nextGameStartTime!: Date | null;
  globalEnemySpawnThreshold: number;
  globalClock: ClockInterface;
  playersAtStart!: number;
  globalEnemyToAdd!: Enemy | null;
  timeSinceLastPlayerListUpdate: number;

  constructor(
    host: universal.GameWebSocket<UserData>,
    mode: GameMode,
    noHost?: boolean
  ) {
    super(host, mode, noHost);
    this.nextGameStartTime = null;
    this.globalEnemySpawnThreshold =
      GAME_DATA_CONSTANTS.DEFAULT_MULTIPLAYER_GLOBAL_ENEMY_STARTING_SPAWN_THRESHOLD;
    this.globalClock = {
      enemySpawn: {
        currentTime: 0,
        actionTime:
          GAME_DATA_CONSTANTS.DEFAULT_MULTIPLAYER_GLOBAL_ENEMY_SPAWN_ACTION_TIME
      },
      forcedEnemySpawn: {
        currentTime: 0,
        actionTime:
          GAME_DATA_CONSTANTS.DEFAULT_MULTIPLAYER_FORCED_ENEMY_SPAWN_ACTION_TIME
      }
    };
    // this isn't in `globalClock` because it's not part of gameplay.
    this.timeSinceLastPlayerListUpdate = 0;
    globalThis.rooms.push(this);
  }

  startPlay() {
    this.gameActionRecord.initialize();

    // set custom settings to correct values
    // for custom multiplayer
    if (this.mode === GameMode.CustomMultiplayer) {
      this.globalEnemySpawnThreshold = this.customSettings.enemySpawnThreshold;
      this.globalClock.enemySpawn.actionTime =
        this.customSettings.enemySpawnTime;
      this.globalClock.forcedEnemySpawn.actionTime =
        this.customSettings.forcedEnemySpawnTime;
    }

    for (const member of this.memberConnectionIDs) {
      const socket = universal.getSocketFromConnectionID(member);
      if (socket) {
        const playerGameData = new MultiplayerGameData(socket, this.mode);
        if (this.mode === GameMode.CustomMultiplayer) {
          playerGameData.setValuesToCustomSettings(this.customSettings);
        }
        this.gameData.push(playerGameData);
        // add add user to record
        this.gameActionRecord.addAction({
          scope: "room",
          action: Action.AddUser,
          timestamp: Date.now(),
          data: {
            playerAdded: getUserReplayDataFromSocket(socket)
          }
        });
      }
    }

    this.ranking = [];
    this.connectionIDsThisRound = _.clone(this.memberConnectionIDs);
    this.playing = true;
    this.playersAtStart = this.gameData.length;

    // FIXME: may not be the same
    for (const playerData of this.gameData) {
      const gameSettings = convertGameSettingsToReplayActions(playerData);
      for (const setting in gameSettings) {
        // this.gameActionRecord.addAction({
        //   scope: "room",
        //   action: Action.SetGameData,
        //   timestamp: Date.now(),
        //   data: {
        //     key: setting,
        //     value: gameSettings[setting]
        //   }
        // });
        this.gameActionRecord.addSetGameDataAction(
          playerData,
          "player",
          setting,
          gameSettings[setting]
        );
      }
    }

    log.info(`Room ${this.id} has started play!`);
  }

  update() {
    // Update for all types of rooms
    let now: number = Date.now();
    let deltaTime: number = now - this.lastUpdateTime;
    super.update(deltaTime);
    this.lastUpdateTime = now;
    this.timeSinceLastPlayerListUpdate += deltaTime;

    // other global stuff
    if (this.timeSinceLastPlayerListUpdate >= PLAYER_LIST_UPDATE_INTERVAL) {
      for (const connectionID of this.memberConnectionIDs) {
        const socket = universal.getSocketFromConnectionID(connectionID);
        if (!socket) {
          continue;
        }
        const rankingPayload = utilities.generateRankingPayload(
          _.clone(this.ranking)
        );
        socket.send(
          JSON.stringify({
            message: "modifyMultiplayerRankContent",
            scope:
              this.mode == GameMode.DefaultMultiplayer ? "default" : "custom",
            data: rankingPayload
          })
        );
        const playersPayload = utilities.generatePlayerListPayload(
          this.memberConnectionIDs
        );
        const playerCountSelector =
          "#main-content__custom-multiplayer-intermission-screen-container__player-count";
        const playerCountText = this.memberConnectionIDs.length.toString();
        changeClientSideText(socket, playerCountSelector, playerCountText);
        socket.send(
          JSON.stringify({
            message: "modifyPlayerListContent",
            scope:
              this.mode == GameMode.DefaultMultiplayer ? "default" : "custom",
            data: playersPayload
          })
        );
      }
      this.timeSinceLastPlayerListUpdate = 0;
    }

    // change text, regardless of whether room is playing or not.
    for (const connectionID of this.memberConnectionIDs) {
      const socket = universal.getSocketFromConnectionID(connectionID);
      if (!socket) {
        continue;
      }
      const roomCodeSelector =
        "#custom-multiplayer-room-indicator-label__room-code";
      changeClientSideText(socket, roomCodeSelector, this.id);

      const hostNameSelector =
        "#main-content__custom-multiplayer-intermission-screen-container__host-name";
      const hostName =
        universal.getNameFromConnectionID(
          this.host?.getUserData().connectionID ?? "???"
        ) || "(unknown)";
      changeClientSideText(socket, hostNameSelector, hostName);
    }

    if (!this.playing) {
      for (const connectionID of this.memberConnectionIDs) {
        const socket = universal.getSocketFromConnectionID(connectionID);
        if (!socket) {
          continue;
        }
        const selector =
          "#main-content__custom-multiplayer-intermission-screen-container__game-status-message";

        if (connectionID === this.host?.getUserData().connectionID) {
          const value = `You are the host of this room! Type "/start" in chat to start the game. You can also type "/?" in chat to view commands that allow you to customize this room's settings.`;
          changeClientSideText(socket, selector, value);
        } else {
          const value = `Waiting for host to start...`;
          changeClientSideText(socket, selector, value);
        }
      }
      return;
    }

    // playing
    for (const connectionID of this.memberConnectionIDs) {
      const socket = universal.getSocketFromConnectionID(connectionID);
      if (!socket) {
        continue;
      }
      const playersRemaining = this.gameData.length;
      const selector =
        "#main-content__custom-multiplayer-intermission-screen-container__game-status-message";
      const value = `Current game in progress. (Remaining: ${playersRemaining}/${this.playersAtStart})`;
      changeClientSideText(socket, selector, value);
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
        enemy.move(
          GAME_DATA_CONSTANTS.ENEMY_BASE_SPEED *
            data.enemySpeedCoefficient *
            (deltaTime / 1000)
        );
        if (enemy.sPosition <= 0) {
          this.gameActionRecord.addEnemyReachedBaseAction(enemy, data);
          enemy.remove(data, 10);
          this.gameActionRecord.addSetGameDataAction(
            data,
            "player",
            "baseHealth",
            data.baseHealth
          );
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
        const eliminationActionRecord: ActionRecord = {
          scope: "room",
          action: Action.Elimination,
          timestamp: Date.now(),
          data: {
            eliminated: getUserReplayDataFromSocket(data.owner)
          }
        };
        this.gameActionRecord.addAction(eliminationActionRecord);
      }

      // clocks
      checkPlayerMultiplayerRoomClocks(data);

      // attributes
      const enemyAttributes = getEnemyAttributesBasedOnGameData(data);

      // forced enemy (when zero)
      if (data.enemies.length === 0) {
        const enemyNumber = data.enemiesSpawned;
        const enemy = createNewEnemy(`F${enemyNumber}`, enemyAttributes);
        this.gameActionRecord.addEnemySpawnAction(enemy, data);
        data.enemies.push(_.clone(enemy));
        data.enemiesSpawned++;
      }

      // generated enemy
      if (this.globalEnemyToAdd) {
        data.enemiesSpawned++;
        data.enemies.push(_.clone(this.globalEnemyToAdd as Enemy));
        this.gameActionRecord.addEnemySpawnAction(this.globalEnemyToAdd, data);
      }

      // received enemy
      if (data.receivedEnemiesToSpawn > 0) {
        data.receivedEnemiesToSpawn--;
        data.enemiesSpawned++;

        const attributes = getEnemyAttributesBasedOnGameData(data);
        attributes.speed =
          GAME_DATA_CONSTANTS.ENEMY_BASE_SPEED * data.enemySpeedCoefficient;

        const receivedEnemy = enemy.createNewReceivedEnemy(
          `R${data.enemiesSpawned}`,
          attributes
        );
        data.enemies.push(_.clone(receivedEnemy));
        this.gameActionRecord.addEnemySpawnAction(receivedEnemy, data, true);
      }

      if (data.enemiesSentStock > 0) {
        data.enemiesSentStock--;
        let targetedOpponentGameData = _.sample(opponentGameData);
        if (targetedOpponentGameData) {
          targetedOpponentGameData.receivedEnemiesStock += 1;
          targetedOpponentGameData.totalEnemiesReceived += 1;
          const room = findRoomWithConnectionID(
            targetedOpponentGameData.ownerConnectionID
          );
          if (room) {
            room.gameActionRecord.addStockAddAction(
              targetedOpponentGameData,
              1
            );
          }
        }
      }
    }
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
        const message = this.hidden
          ? "This room is hidden. It is not shown in the room list, but other players may still join through the room code."
          : "This room is public. It is shown in the room list, and other players can also join through the room code.";
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

  eliminateSocketID(connectionID: string, gameData: GameData | object) {
    const socket = universal.getSocketFromConnectionID(connectionID);
    if (typeof socket === "undefined") {
      log.warn(
        `Socket ID ${connectionID} not found while eliminating it from multiplayer room, but deleting anyway.`
      );
    }
    const socketUserData = socket?.getUserData();
    const place = this.gameData.length;
    if (gameData instanceof GameData) {
      const data = {
        placement: place,
        name: universal.getNameFromConnectionID(connectionID) || "???",
        time: gameData.elapsedTime,
        sent: gameData.totalEnemiesSent,
        received: gameData.totalEnemiesReceived,
        isRegistered: false,
        nameColor: "#ffffff",
        userID: "",
        connectionID: gameData.ownerConnectionID
      };
      if (typeof socketUserData?.ownerUserID === "string") {
        // is registered
        data.isRegistered = true;
        data.userID = socketUserData.ownerUserID;
        data.nameColor = socketUserData.playerRank.color;
      }
      this.ranking.push(data);
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
      )}) has been eliminated from Multiplayer Room with ID ${this.id}`
    );
    // give exp to eliminated player
    // add to ranking
    this.checkIfGameFinished(this.gameData);
  }

  async checkIfGameFinished(gameDataArray: Array<GameData>) {
    if (gameDataArray.length <= 1) {
      // game finished
      log.info(`Custom Multiplayer Room ID ${this.id} has finished playing.`);
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

        // add winner action
        if (winnerSocket) {
          const winnerActionRecord: ActionRecord = {
            scope: "room",
            action: Action.DeclareWinner,
            timestamp: Date.now(),
            data: {
              winner: getUserReplayDataFromSocket(winnerSocket)
            }
          };
          this.gameActionRecord.addAction(winnerActionRecord);
        }

        this.gameActionRecord.addGameOverAction();

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
          userID: "",
          connectionID: winnerGameData.ownerConnectionID
        };
        if (winnerSocket?.getUserData().ownerUserID) {
          // is registered
          const winnerSocketUserData = winnerSocket.getUserData();
          data.isRegistered = true;
          data.userID = winnerSocketUserData.ownerUserID ?? "";
          data.nameColor = winnerSocketUserData.playerRank?.color ?? "#ffffff";
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
      )}) has quit Multiplayer Room ${this.id}`
    );
    if (socket) {
      socket?.unsubscribe(this.id);
      this.deleteMember(socket);
    }
  }

  stopPlay() {
    this.playing = false;
    this.nextGameStartTime = new Date(
      Date.now() + GAME_DATA_CONSTANTS.DEFAULT_MULTIPLAYER_INTERMISSION_TIME
    );
    this.connectionIDsThisRound = [];
    this.gameData = [];
    // send everyone to intermission

    log.info(`Room ${this.id} has stopped play.`);
  }

  summonEveryoneToGameplay() {
    for (const connectionID of this.memberConnectionIDs) {
      const socket = universal.getSocketFromConnectionID(connectionID);
      if (!socket) {
        log.warn("Socket is falsy. Unable to send player to game screen.");
        continue;
      }
      // send to canvas screen
      socket.send(
        JSON.stringify({
          message: "changeScreen",
          newScreen: "canvas"
        })
      );
    }
  }

  summonEveryoneToIntermission() {
    // TODO: Add spectators once they get implemented
    for (const connectionID of this.memberConnectionIDs) {
      let socket = universal.getSocketFromConnectionID(connectionID);
      if (typeof socket === "undefined") {
        log.warn(
          `Socket ID ${connectionID} not found while summoning it to custom lobby, therefore skipping process.`
        );
        continue;
      }
      socket.send(
        JSON.stringify({
          message: "changeScreen",
          newScreen: "customMultiplayerIntermission"
        })
      );
    }
  }

  setNewHost(connectionID: string) {
    if (this.mode === GameMode.DefaultMultiplayer) {
      log.warn(`Can't set host for the Multiplayer Room with ID ${this.id}.`);
      return;
    }
    const newHost = universal.getSocketFromConnectionID(connectionID);
    if (!newHost) {
      log.error(`Can't find new host's socket! ${connectionID}`);
      // TODO: Force everyone to leave???
      return;
    }
    this.host = newHost;
  }

  notifyOfNewHost(newHostConnectionID: string) {
    const pastHostConnectionID = this.host?.getUserData().connectionID;
    const newHost = universal.getNameFromConnectionID(newHostConnectionID);

    if (!pastHostConnectionID) {
      // here just in case
      log.warn(`Can't find past host connection ID when declaring new host.`);
      log.info(`Room ${this.id}'s host now ${newHost}.`);

      const message = `This room's host is now ${newHost}, since the original host left the room.`;
      this.addChatMessage(message, { isSystemMessage: true });
      return;
    }

    const pastHost = universal.getNameFromConnectionID(pastHostConnectionID);
    const message = `This room's host is now ${newHost}, since the original host, ${pastHost} has left the room.`;
    this.addChatMessage(message, { isSystemMessage: true });

    log.info(`Room ${this.id}'s host now ${newHost} from ${pastHost}.`);
  }

  handleHostLeave() {
    // Note that we already called `.abort` before this,
    // which already removes the
    // connectionID from `room.memberConnectionIDs`
    // So, there is no need to delete member (again) here.
    // It's here since we have to find a new host, and if there's only
    // one socket before leaving, the room is empty and can be destroyed.

    if (this.memberConnectionIDs.length === 0) {
      log.info(`About to delete room ${this.id}...`);
    } else {
      const newHostID = _.sample(this.memberConnectionIDs) as string;
      this.notifyOfNewHost(newHostID);
      this.setNewHost(newHostID);

      // notify the new host as well
      const newHostSocket = universal.getSocketFromConnectionID(newHostID);
      if (newHostSocket) {
        const MESSAGE =
          "You have been randomly selected to be the new host of this room since the previous host left.";
        this.sendCommandResultToSocket(MESSAGE, { sender: newHostSocket });
      }
    }
  }
}

export { MultiplayerRoom };
