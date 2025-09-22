import _ from "lodash";
import { log } from "../core/log";
import {
  getUserReplayDataFromSocket,
  convertGameSettingsToReplayActions,
  findRoomWithConnectionID,
  sleep
} from "../core/utilities";
import { User } from "../models/User";
import { Action, ActionRecord } from "../replay/recording/ActionRecord";
import { getSocketFromConnectionID } from "../universal";
import {
  checkGlobalMultiplayerRoomClocks,
  checkPlayerMultiplayerRoomClocks
} from "./actions/clocks";
import { changeClientSideText } from "./actions/send-html";
import { createNewEnemy } from "./Enemy";
import {
  ClockInterface,
  GameMode,
  MultiplayerGameData,
  GameData,
  GAME_DATA_CONSTANTS
} from "./GameData";
import {
  defaultMultiplayerRoomID,
  Room,
  setDefaultMultiplayerRoomID
} from "./Room";
import * as universal from "../universal";
import * as utilities from "../core/utilities";
import { Enemy } from "./Enemy";
import * as enemy from "./Enemy";
import { MultiplayerRoom } from "./MultiplayerRoom";

const PLAYER_LIST_UPDATE_INTERVAL = 1000;

class DefaultMultiplayerRoom extends MultiplayerRoom {
  nextGameStartTime!: Date | null;
  globalEnemySpawnThreshold: number;
  globalClock: ClockInterface;
  playersAtStart!: number;
  globalEnemyToAdd!: Enemy | null;
  timeSinceLastPlayerListUpdate: number;

  constructor(host: universal.GameSocket, mode: GameMode, noHost?: boolean) {
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

    // special for default multiplayer
    // check if default multiplayer room already exists
    if (mode === GameMode.DefaultMultiplayer && defaultMultiplayerRoomID) {
      log.warn(`There may only be one Default Multiplayer room at at time.`);
      log.warn(`There is one, which is ID ${defaultMultiplayerRoomID}.`);
      this.destroy();
      return;
    } else if (mode === GameMode.DefaultMultiplayer) {
      setDefaultMultiplayerRoomID(this.id);
    }
    universal.rooms.push(this);
  }

  startPlay() {
    this.gameActionRecord.initialize();

    for (const member of this.memberConnectionIDs) {
      const socket = universal.getSocketFromConnectionID(member);
      if (socket) {
        this.gameData.push(new MultiplayerGameData(socket, this.mode));
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

    // FIXME: may not be the same
    for (const playerData of this.gameData) {
      const gameSettings = convertGameSettingsToReplayActions(playerData);
      for (const setting in gameSettings) {
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
    super.update();
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
          "#main-content__multiplayer-intermission-screen-container__player-count";
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

    // Then update specifically for Default Multiplayer rooms
    if (!this.playing) {
      // Check if there is at least 2 players and timer hasn't started countdown.
      // If so, start intermission countdown
      if (
        !this.nextGameStartTime &&
        this.memberConnectionIDs.length >=
          GAME_DATA_CONSTANTS.DEFAULT_MULTIPLAYER_MINIMUM_PLAYERS_TO_START
      ) {
        const nextGameStartTime =
          Date.now() +
          GAME_DATA_CONSTANTS.DEFAULT_MULTIPLAYER_INTERMISSION_TIME;
        this.nextGameStartTime = new Date(nextGameStartTime);
      }
      // Check if there is less than 2 players - if so, stop intermission countdown
      if (
        this.nextGameStartTime instanceof Date &&
        this.memberConnectionIDs.length <
          GAME_DATA_CONSTANTS.DEFAULT_MULTIPLAYER_MINIMUM_PLAYERS_TO_START
      ) {
        this.nextGameStartTime = null;
      }
      // Start game
      if (this.nextGameStartTime && new Date() >= this.nextGameStartTime) {
        this.startPlay();
        this.playersAtStart = this.memberConnectionIDs.length;
        this.summonEveryoneToGameplay();
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
          } else if (
            this.memberConnectionIDs.length <
            GAME_DATA_CONSTANTS.DEFAULT_MULTIPLAYER_MINIMUM_PLAYERS_TO_START
          ) {
            const value = `Waiting for at least ${GAME_DATA_CONSTANTS.DEFAULT_MULTIPLAYER_MINIMUM_PLAYERS_TO_START} players.`;
            changeClientSideText(socket, selector, value);
          }
        }
      }
      return;
    }

    // playing
    // for (const connectionID of this.memberConnectionIDs) {
    //   const socket = universal.getSocketFromConnectionID(connectionID);
    //   if (!socket) {
    //     return;
    //   }
    //   const playersRemaining = this.gameData.length;
    //   const selector =
    //     "#main-content__multiplayer-intermission-screen-container__game-status-message";
    //   const value = `Current game in progress. (Remaining: ${playersRemaining}/${this.playersAtStart})`;
    //   changeClientSideText(socket, selector, value);
    // }

    // // global - applies to all players
    // // global clocks
    // this.globalClock.enemySpawn.currentTime += deltaTime;
    // this.globalClock.forcedEnemySpawn.currentTime += deltaTime;
    // checkGlobalMultiplayerRoomClocks(this);

    // // specific to each player
    // for (const data of this.gameData) {
    //   const opponentGameData = this.gameData.filter(
    //     (element) => element.ownerConnectionID !== data.ownerConnectionID
    //   );

    //   if (data.aborted) {
    //     this.abort(data);
    //   }

    //   for (const enemy of data.enemies) {
    //     enemy.move(
    //       GAME_DATA_CONSTANTS.ENEMY_BASE_SPEED *
    //         GAME_DATA_CONSTANTS.DEFAULT_MULTIPLAYER_ENEMY_STARTING_SPEED_COEFFICIENT *
    //         data.enemySpeedCoefficient *
    //         (deltaTime / 1000)
    //     );
    //     if (enemy.sPosition <= 0) {
    //       this.gameActionRecord.addEnemyReachedBaseAction(enemy, data);
    //       enemy.remove(data, 10);
    //       this.gameActionRecord.addSetGameDataAction(
    //         data,
    //         "player",
    //         "baseHealth",
    //         data.baseHealth
    //       );
    //     }
    //   }
    //   if (data.baseHealth <= 0) {
    //     // player is eliminated.
    //     const socket = universal.getSocketFromConnectionID(
    //       data.ownerConnectionID
    //     );
    //     if (socket && !data.aborted) {
    //       socket.send(
    //         JSON.stringify({
    //           message: "changeScreen",
    //           newScreen: "multiplayerIntermission"
    //         })
    //       );
    //     }

    //     this.eliminateSocketID(data.ownerConnectionID, data);
    //     const eliminationActionRecord: ActionRecord = {
    //       scope: "room",
    //       action: Action.Elimination,
    //       timestamp: Date.now(),
    //       data: {
    //         eliminated: getUserReplayDataFromSocket(data.owner)
    //       }
    //     };
    //     this.gameActionRecord.addAction(eliminationActionRecord);
    //   }

    //   // clocks
    //   checkPlayerMultiplayerRoomClocks(data);

    //   // forced enemy (when zero)
    //   if (data.enemies.length === 0) {
    //     const enemy = createNewEnemy(`F${data.enemiesSpawned}`);
    //     this.gameActionRecord.addEnemySpawnAction(enemy, data);
    //     data.enemies.push(_.clone(enemy));
    //     data.enemiesSpawned++;
    //   }

    //   // generated enemy
    //   if (this.globalEnemyToAdd) {
    //     data.enemiesSpawned++;
    //     data.enemies.push(_.clone(this.globalEnemyToAdd as Enemy));
    //     this.gameActionRecord.addEnemySpawnAction(this.globalEnemyToAdd, data);
    //   }

    //   // received enemy
    //   if (data.receivedEnemiesToSpawn > 0) {
    //     data.receivedEnemiesToSpawn--;
    //     data.enemiesSpawned++;
    //     const attributes = {
    //       speed:
    //         GAME_DATA_CONSTANTS.ENEMY_BASE_SPEED * data.enemySpeedCoefficient
    //     };
    //     const receivedEnemy = enemy.createNewReceivedEnemy(
    //       `R${data.enemiesSpawned}`,
    //       attributes
    //     );
    //     data.enemies.push(_.clone(receivedEnemy));
    //     this.gameActionRecord.addEnemySpawnAction(receivedEnemy, data, true);
    //   }

    //   if (data.enemiesSentStock > 0) {
    //     data.enemiesSentStock--;
    //     let targetedOpponentGameData = _.sample(opponentGameData);
    //     if (targetedOpponentGameData) {
    //       targetedOpponentGameData.receivedEnemiesStock += 1;
    //       targetedOpponentGameData.totalEnemiesReceived += 1;
    //       const room = findRoomWithConnectionID(
    //         targetedOpponentGameData.ownerConnectionID
    //       );
    //       if (room) {
    //         room.gameActionRecord.addStockAddAction(
    //           targetedOpponentGameData,
    //           1
    //         );
    //       }
    //     }
    //   }
    // }
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
        userID: "",
        connectionID: gameData.ownerConnectionID
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
          userID: "",
          connectionID: winnerGameData.ownerConnectionID
        };
        if (winnerSocket?.ownerUserID) {
          // is registered
          data.isRegistered = true;
          data.userID = winnerSocket.ownerUserID;
          data.nameColor = winnerSocket.playerRank?.color ?? "#ffffff";
        }
        this.ranking.push(data);
        // submit replay here.

        if (
          this.memberConnectionIDs.filter(
            (e) => getSocketFromConnectionID(e)?.loggedIn
          ).length >= 1
        ) {
          const replay = await this.gameActionRecord.save(
            this.mode,
            this.ranking
          );
          if (!universal.STATUS.databaseAvailable) {
            log.warn("Not saving multiplayer because database is unavailable.");
          } else {
            if (replay.ok) {
              this.addChatMessage(
                `Default Multiplayer game replay saved with Replay ID ${replay.id}.`,
                null,
                true
              );
            }
          }
        } else {
          log.info("Not saving multiplayer game because no one is logged in.");
        }
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
      const userID = socket.ownerUserID;
      socket.send(
        JSON.stringify({
          message: "changeScreen",
          newScreen: "canvas"
        })
      );
      // add games played
      if (!universal.STATUS.databaseAvailable) {
        log.warn("Database is not available. Not running database operation.");
        continue;
      }
      if (typeof userID !== "string") {
        log.warn("User ID is not string. Not running database operation.");
        continue;
      }
      User.addGamesPlayedToUserID(userID, 1);
      User.addMultiplayerGamesPlayedToUserID(userID, 1);
    }
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

export { DefaultMultiplayerRoom };
