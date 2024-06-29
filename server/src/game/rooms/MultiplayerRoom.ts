import * as utilities from "../../core/utilities";
import * as universal from "../../universal";
import * as enemy from "../Enemy";
import * as _ from "lodash";
import { log } from "../../core/log";
import { sleep } from "../../core/utilities";
import { User } from "../../models/User";
import {
  GameData,
  MultiplayerGameData,
  GameMode,
  ClockInterface
} from "../GameData";
import {
  changeClientSideHTML,
  changeClientSideText
} from "../actions/send-html";
import {
  checkGlobalMultiplayerRoomClocks,
  checkPlayerMultiplayerRoomClocks
} from "../actions/clocks";
import { Room } from "./Room";

const DEFAULT_MULTIPLAYER_INTERMISSION_TIME = 1000 * 10;
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

let defaultMultiplayerRoomID: string | null = null;

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
    for (let connectionID of this.memberConnectionIDs) {
      const socket = universal.getSocketFromConnectionID(connectionID);
      if (socket) {
        const rankingSelector =
          "#main-content__multiplayer-intermission-screen-container__game-status-ranking";
        const rankingText = utilities.generateRankingText(
          _.clone(this.ranking)
        );
        const playersSelector =
          "#main-content__multiplayer-intermission-screen-container__player-list";
        const playersText = utilities.generatePlayerListText(
          this.memberConnectionIDs
        );
        changeClientSideHTML(socket, rankingSelector, rankingText);
        changeClientSideHTML(socket, playersSelector, playersText);
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
          for (let connectionID of this.memberConnectionIDs) {
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
      for (let connectionID of this.memberConnectionIDs) {
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
      for (let connectionID of this.memberConnectionIDs) {
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
      for (let data of this.gameData) {
        let opponentGameData = this.gameData.filter(
          (element) => element.ownerConnectionID !== data.ownerConnectionID
        );

        if (data.aborted) {
          this.abort(data);
        }

        for (let enemy of data.enemies) {
          enemy.move(0.1 * data.enemySpeedCoefficient * (deltaTime / 1000));
          if (enemy.sPosition <= 0) {
            enemy.remove(data, 10);
          }
        }
        if (data.baseHealth <= 0) {
          // player is eliminated.
          let socket = universal.getSocketFromConnectionID(
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
    let socket = universal.getSocketFromConnectionID(connectionID);
    if (typeof socket === "undefined") {
      log.warn(
        `Socket ID ${connectionID} not found while eliminating it from multiplayer room, but deleting anyway.`
      );
    }
    const place = this.gameData.length;
    if (gameData instanceof GameData) {
      this.ranking.push({
        placement: place,
        name: universal.getNameFromConnectionID(connectionID) || "???",
        time: gameData.elapsedTime,
        sent: gameData.totalEnemiesSent,
        received: gameData.totalEnemiesReceived
      });
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
        let userID = universal.getSocketFromConnectionID(
          winnerGameData.ownerConnectionID
        )?.ownerUserID;
        if (typeof userID === "string") {
          if (!universal.STATUS.databaseAvailable) {
            log.warn(
              "Database is not available. Not running database operation."
            );
          } else {
            // multiplayer games won
            User.addMultiplayerGamesWonToUserID(userID as string, 1);
            // experience (50% bonus for winning)
            const earnedEXP =
              Math.round(winnerGameData.elapsedTime / 2000) * 1.5;
            User.giveExperiencePointsToUserID(userID as string, earnedEXP);
          }
        }

        this.ranking.push({
          placement: this.gameData.length,
          name:
            universal.getNameFromConnectionID(
              winnerGameData.ownerConnectionID
            ) || "???",
          time: winnerGameData.elapsedTime,
          sent: winnerGameData.totalEnemiesSent,
          received: winnerGameData.totalEnemiesReceived
        });
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
    for (let connectionID of this.memberConnectionIDs) {
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

export { MultiplayerRoom };
