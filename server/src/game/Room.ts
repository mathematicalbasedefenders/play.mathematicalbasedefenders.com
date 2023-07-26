import * as utilities from "../core/utilities";
import * as universal from "../universal";
import * as enemy from "./Enemy";
import * as _ from "lodash";
import { log } from "../core/log";
import * as input from "../core/input";
import { submitSingleplayerGame } from "../services/score";
import { InputAction } from "../core/input";
import { findRoomWithConnectionID } from "../core/utilities";
import { User } from "../models/User";
import { synchronizeDataWithSocket } from "../universal";
const NO_HOST_ID = "(no host)";
const DEFAULT_MULTIPLAYER_INTERMISSION_TIME = 1000 * 10;
const MINIFIED_GAME_DATA_KEYS = [
  "baseHealth",
  "combo",
  "currentInput",
  "receivedEnemiesStock"
];
//
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
// TODO: Change design
let defaultMultiplayerRoomID: string | null = null;

enum GameMode {
  EasySingleplayer = "easySingleplayer",
  StandardSingleplayer = "standardSingleplayer",
  InsaneSingleplayer = "insaneSingleplayer",
  DefaultMultiplayer = "defaultMultiplayer",
  CustomMultiplayer = "customMultiplayer",
  CustomSingleplayer = "customSingleplayer"
}
interface InputActionInterface {
  action: InputAction;
  argument: string;
}
interface ClockInterface {
  [key: string]: {
    currentTime: number;
    actionTime: number;
  };
}

/**
 * Base class for `GameData`.
 */
class GameData {
  score!: number;
  enemiesKilled!: number;
  enemiesSpawned!: number;
  enemies!: Array<enemy.Enemy>;
  baseHealth!: number;
  combo!: number;
  owner: string;
  clocks!: ClockInterface;
  enemiesToErase!: Array<string>;
  currentInput!: string;
  elapsedTime!: number;
  enemySpeedCoefficient!: number;
  commands!: { [key: string]: any };
  mode: string;
  enemySpawnThreshold!: number;
  aborted: boolean;
  totalEnemiesSent!: number;
  totalEnemiesReceived!: number;
  enemiesSentStock!: number;
  opponentGameData!: Array<GameData>;
  ownerName!: string;

  // ...
  attackScore!: number;
  receivedEnemiesStock!: number;
  receivedEnemiesToSpawn!: number;
  constructor(owner: string, mode: GameMode) {
    this.mode = mode;
    this.score = 0;
    this.enemiesKilled = 0;
    this.enemiesSpawned = 0;
    this.baseHealth = 100;
    this.owner = owner;
    this.ownerName = universal.getNameFromConnectionID(owner) || "???";
    this.enemies = [];
    this.enemiesToErase = [];
    this.currentInput = "";
    this.elapsedTime = 0;
    this.combo = -1;
    this.commands = {};
    this.aborted = false;
    this.totalEnemiesSent = 0;
    this.totalEnemiesReceived = 0;
    this.enemiesSentStock = 0;
    this.attackScore = 0;

    if (mode === GameMode.EasySingleplayer) {
      this.clocks = {
        enemySpawn: {
          currentTime: 0,
          actionTime: 250
        },
        forcedEnemySpawn: {
          currentTime: 0,
          actionTime: 7500
        },
        comboReset: {
          currentTime: 0,
          actionTime: 10000
        }
      };
      this.enemySpeedCoefficient = 0.5;
      this.enemySpawnThreshold = 0.05;
    } else {
      this.clocks = {
        enemySpawn: {
          currentTime: 0,
          actionTime: 100
        },
        forcedEnemySpawn: {
          currentTime: 0,
          actionTime: 2500
        },
        comboReset: {
          currentTime: 0,
          actionTime: 5000
        }
      };
      this.enemySpeedCoefficient = 1;
      this.enemySpawnThreshold = 0.1;
    }
  }
}
class SingleplayerGameData extends GameData {
  // nothing here yet...

  constructor(owner: string, gameMode: GameMode) {
    if (
      !(
        gameMode === GameMode.EasySingleplayer ||
        gameMode === GameMode.StandardSingleplayer
      )
    ) {
      log.error(
        "Non-singleplayer game mode passed as argument in a singleplayer room."
      );
      return;
    }
    super(owner, gameMode);
  }
}

class CustomSingleplayerGameData extends GameData {
  constructor(
    owner: string,
    gameMode: GameMode,
    settings: { [key: string]: any }
  ) {
    if (!(gameMode === GameMode.CustomSingleplayer)) {
      log.error(
        "Non-custom singleplayer game mode passed in a custom s.p. room."
      );
      return;
    }
    super(owner, gameMode);
    // This assumes that data has already been validated.
    this.baseHealth = settings.baseHealth;
    this.clocks.comboReset.actionTime = settings.comboTime;
    this.enemySpeedCoefficient = settings.enemySpeedCoefficient;
    this.clocks.enemySpawn.actionTime = settings.enemySpawnTime;
    this.enemySpawnThreshold = settings.enemySpawnThreshold;
    this.clocks.forcedEnemySpawn.actionTime = settings.forcedEnemySpawnTime;
  }
}

class MultiplayerGameData extends GameData {
  constructor(owner: string, gameMode: GameMode) {
    if (
      !(
        gameMode === GameMode.DefaultMultiplayer ||
        gameMode === GameMode.CustomMultiplayer
      )
    ) {
      log.error(
        "Non-multiplayer game mode passed as argument in a multiplayer room."
      );
      return;
    }
    super(owner, gameMode);
    this.receivedEnemiesStock = 0;
    this.receivedEnemiesToSpawn = 0;
  }
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
  // custom room exclusive
  customSettings!: { [key: string]: any };
  // constructor below

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
    // this.addMember(host);
    this.lastUpdateTime = Date.now();

    // special for default multiplayer
    // check if default multiplayer room already exists
    if (gameMode === GameMode.DefaultMultiplayer && defaultMultiplayerRoomID) {
      log.warn(`There may only be one Default Multiplayer room at at time.`);
      log.warn(
        `A Default Multiplayer room with ID ${defaultMultiplayerRoomID} already exists.`
      );
      this.destroy();
      return;
    } else if (gameMode === GameMode.DefaultMultiplayer) {
      defaultMultiplayerRoomID = this.id;
    }

    log.info(`Created ${gameMode} room with ID ${this.id}`);
  }

  update(deltaTime: number) {
    if (!this.playing) {
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
      // log.info("Custom mode selected: ", settings);
      // FIXME: This assumes that data already has been validated.
      setCustomRules(this, settings);
    }
  }

  startPlay() {
    if (
      this.mode === GameMode.EasySingleplayer ||
      this.mode === GameMode.StandardSingleplayer
    ) {
      for (let member of this.memberConnectionIDs) {
        this.gameData.push(new SingleplayerGameData(member, this.mode));
      }
    } else if (this.mode === GameMode.CustomSingleplayer) {
      for (let member of this.memberConnectionIDs) {
        this.gameData.push(
          new CustomSingleplayerGameData(member, this.mode, this.customSettings)
        );
      }
      log.info(`Room ${this.id} has started play!`);
    }
  }

  async startGameOverProcess(data: GameData) {
    let socket = universal.getSocketFromConnectionID(data.owner);
    let messages = "";
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

    data.commands.updateText = [
      {
        value: {
          selector: "#main-content__game-over-screen__stats__score",
          newText: data.score.toString()
        },
        age: 0
      },
      {
        value: {
          selector: "#main-content__game-over-screen__stats__game-mode",
          newText: gameMode
        },
        age: 0
      },
      {
        value: {
          selector: "#main-content__game-over-screen__stats__enemies",
          newText: `Enemies: ${data.enemiesKilled}/${data.enemiesSpawned} (${(
            (data.enemiesKilled / data.elapsedTime) *
            1000
          ).toFixed(3)}/s)`
        },
        age: 0
      },
      {
        value: {
          selector: "#main-content__game-over-screen__stats__time",
          newText: utilities.millisecondsToTime(data.elapsedTime)
        },
        age: 0
      },
      {
        value: {
          selector: "#main-content__game-over-screen__stats__score-rank",
          newText: messages
        },
        age: 0
      }
    ];
    data.commands.changeScreenTo = [{ value: "gameOver", age: 0 }];
    if (socket) {
      synchronizeDataWithSocket(socket);
    }
    // submit score
    if (socket) {
      submitSingleplayerGame(data, socket);
    }
    // destroy room somehow
    this.playing = false;
    if (socket) {
      socket?.unsubscribe(this.id);
      this.deleteMember(socket);
    }
  }

  update(): void {
    // Update for all types of rooms
    let now: number = Date.now();
    let deltaTime: number = now - this.lastUpdateTime;
    super.update(deltaTime);
    this.lastUpdateTime = now;
    // Then update for all singleplayer rooms
    let data = this.gameData[0];
    if (data.aborted) {
      this.abort(data);
    }
    let enemyToAdd: enemy.Enemy | null = null;

    for (let data of this.gameData) {
      // FIXME: ???
      // Move all the enemies down.
      for (let enemy of data.enemies) {
        enemy.move(0.1 * data.enemySpeedCoefficient * (deltaTime / 1000));
        if (enemy.sPosition <= 0) {
          enemy.remove(data, 10);
        }
      }
      if (data.baseHealth <= 0) {
        this.startGameOverProcess(data);
      }

      // clocks
      // Add enemy if forced time up
      if (
        data.clocks.forcedEnemySpawn.currentTime >=
        data.clocks.forcedEnemySpawn.actionTime
      ) {
        enemyToAdd = generateEnemyWithChance(
          1,
          this.updateNumber,
          0.1 * data.enemySpeedCoefficient
        );
        data.clocks.forcedEnemySpawn.currentTime -=
          data.clocks.forcedEnemySpawn.actionTime;
        // reset time
        data.clocks.forcedEnemySpawn.currentTime = 0;
      }
      // Add enemy if generated.
      if (
        data.clocks.enemySpawn.currentTime >=
          data.clocks.enemySpawn.actionTime &&
        enemyToAdd == null
      ) {
        enemyToAdd = generateEnemyWithChance(
          data.enemySpawnThreshold,
          this.updateNumber,
          0.1 * data.enemySpeedCoefficient
        );
        data.clocks.enemySpawn.currentTime -= data.clocks.enemySpawn.actionTime;
      }
      // combo time
      if (
        data.clocks.comboReset.currentTime >= data.clocks.comboReset.actionTime
      ) {
        data.combo = -1;
        data.clocks.comboReset.currentTime -= data.clocks.comboReset.actionTime;
      }
      if (enemyToAdd) {
        // reset forced enemy spawn
        data.clocks.forcedEnemySpawn.currentTime = 0;
        data.enemiesSpawned++;
        data.enemies.push(_.clone(enemyToAdd as enemy.Enemy));
      }
    }
  }

  abort(data: GameData) {
    let socket = universal.getSocketFromConnectionID(data.owner);
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
      this.gameData.push(new MultiplayerGameData(member, this.mode));
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
    let playerListText = utilities.generatePlayerListText(
      this.memberConnectionIDs
    );
    for (let connectionID of this.memberConnectionIDs) {
      let socket = universal.getSocketFromConnectionID(connectionID);
      if (socket) {
        socket.send(
          JSON.stringify({
            message: "changeHTML",
            selector:
              "#main-content__multiplayer-intermission-screen-container__game-status-ranking",

            value: utilities.generateRankingText(_.clone(this.ranking))
          })
        );
        socket.send(
          JSON.stringify({
            message: "changeHTML",
            selector:
              "#main-content__multiplayer-intermission-screen-container__player-list",

            value: playerListText
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
        let socket = universal.getSocketFromConnectionID(connectionID);
        if (socket) {
          if (this.nextGameStartTime) {
            let timeLeft = Math.abs(
              Date.now() - this.nextGameStartTime?.getTime()
            );
            socket.send(
              JSON.stringify({
                message: "changeText",
                selector:
                  "#main-content__multiplayer-intermission-screen-container__game-status-message",
                value: `Next game starting in ${(timeLeft / 1000).toFixed(
                  3
                )} seconds.`
              })
            );
          } else if (this.memberConnectionIDs.length < 2) {
            socket.send(
              JSON.stringify({
                message: "changeText",
                selector:
                  "#main-content__multiplayer-intermission-screen-container__game-status-message",
                value: `Waiting for at least 2 players.`
              })
            );
          }
        }
      }
    } else {
      // playing
      // update text first
      // Update Text
      for (let connectionID of this.memberConnectionIDs) {
        let socket = universal.getSocketFromConnectionID(connectionID);
        if (socket) {
          socket.send(
            JSON.stringify({
              message: "changeText",
              selector:
                "#main-content__multiplayer-intermission-screen-container__game-status-message",
              value: `Current game in progress. (Remaining: ${this.gameData.length}/${this.playersAtStart})`
            })
          );
          //
        }
      }

      // all players
      // global - applies to all players
      let enemyToAdd = null;

      // global clocks
      this.globalClock.enemySpawn.currentTime += deltaTime;
      this.globalClock.forcedEnemySpawn.currentTime += deltaTime;

      // Add enemy if forced time up
      if (
        this.globalClock.forcedEnemySpawn.currentTime >=
        this.globalClock.forcedEnemySpawn.actionTime
      ) {
        enemyToAdd = generateEnemyWithChance(
          1,
          this.updateNumber,
          0.1 //TODO: custom multiplayer will mess this up
        );
        this.globalClock.forcedEnemySpawn.currentTime -=
          this.globalClock.forcedEnemySpawn.actionTime;
        // reset time
        this.globalClock.forcedEnemySpawn.currentTime = 0;
      }

      // Add enemy if generated.
      if (
        this.globalClock.enemySpawn.currentTime >=
          this.globalClock.enemySpawn.actionTime &&
        enemyToAdd == null
      ) {
        enemyToAdd = generateEnemyWithChance(
          this.globalEnemySpawnThreshold,
          this.updateNumber,
          0.1 //TODO: custom multiplayer will mess this up
        );
        this.globalClock.enemySpawn.currentTime -=
          this.globalClock.enemySpawn.actionTime;
      }

      // specific to each player
      for (let data of this.gameData) {
        let opponentGameData = this.gameData.filter(
          (element) => element.owner !== data.owner
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
          let socket = universal.getSocketFromConnectionID(data.owner);
          if (socket && !data.aborted) {
            socket.send(
              JSON.stringify({
                message: "changeScreen",
                newScreen: "multiplayerIntermission"
              })
            );
          }

          this.eliminateSocketID(data.owner, data);
        }

        // clocks
        if (
          data.clocks.comboReset.currentTime >=
          data.clocks.comboReset.actionTime
        ) {
          data.combo = -1;
          data.clocks.comboReset.currentTime -=
            data.clocks.comboReset.actionTime;
        }

        // generated enemy
        if (enemyToAdd) {
          // reset forced enemy time
          this.globalClock.forcedEnemySpawn.currentTime = 0;
          data.enemiesSpawned++;
          data.enemies.push(_.clone(enemyToAdd as enemy.Enemy));
        }

        // received enemy
        if (data.receivedEnemiesToSpawn > 0) {
          data.receivedEnemiesToSpawn--;
          data.enemiesSpawned++;
          data.enemies.push(
            enemy.createNewReceived(
              `R${data.enemiesSpawned}`,
              0.1 * data.enemySpeedCoefficient
            )
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

  eliminateSocketID(connectionID: string, gameData: GameData) {
    let socket = universal.getSocketFromConnectionID(connectionID);
    this.ranking.push({
      placement: this.gameData.length,
      name: universal.getNameFromConnectionID(connectionID) || "???",
      time: gameData.elapsedTime,
      sent: gameData.totalEnemiesSent,
      received: gameData.totalEnemiesReceived
    });
    if (typeof socket === "undefined") {
      log.warn(
        `Socket ID ${connectionID} not found while eliminating it from multiplayer room, but deleting anyway.`
      );
      // let gameDataIndex = this.gameData.findIndex(
      //   (element) => element.owner === connectionID
      // );
      // if (gameDataIndex === -1) {
      //   log.warn(
      //     `Socket ID ${connectionID} not found while eliminating it from multiplayer room, therefore skipping process.`
      //   );
      // }
      // return;
    }
    // eliminate the socket
    let gameDataIndex = this.gameData.findIndex(
      (element) => element.owner === connectionID
    );
    if (gameDataIndex === -1) {
      log.warn(
        `Socket ID ${connectionID} not found while eliminating it from multiplayer room, therefore skipping process.`
      );
      return;
    }
    this.gameData.splice(gameDataIndex, 1);
    log.info(
      `Socket ID ${connectionID} (${universal.getNameFromConnectionID(
        connectionID
      )}) has been eliminated from the Default Multiplayer Room`
    );
    // add to ranking
    this.checkIfGameFinished(this.gameData);
  }

  checkIfGameFinished(gameDataArray: Array<GameData>) {
    if (gameDataArray.length <= 1) {
      // game finished
      // Default Multiplayer for now since there's only 1 multiplayer room at a given time.
      log.info(`Default Multiplayer Room has finished playing.`);
      if (gameDataArray.length === 1) {
        let winnerGameData = gameDataArray[0];
        log.info(
          `The winner is socket ID ${
            winnerGameData.owner
          } (${universal.getNameFromConnectionID(winnerGameData.owner)})`
        );
        let userID = universal.getSocketFromConnectionID(
          winnerGameData.owner
        )?.ownerUserID;
        if (typeof userID === "string") {
          if (!universal.STATUS.databaseAvailable) {
            log.warn(
              "Database is not available. Not running database operation."
            );
          } else {
            User.addMultiplayerGamesWonToUserID(userID as string, 1);
          }
        }

        this.ranking.push({
          placement: this.gameData.length,
          name:
            universal.getNameFromConnectionID(winnerGameData.owner) || "???",
          time: winnerGameData.elapsedTime,
          sent: winnerGameData.totalEnemiesSent,
          received: winnerGameData.totalEnemiesReceived
        });
      }
      // stop everyone from playing
      this.stopPlay();
      // bring everyone to intermission screen
      this.summonEveryoneToIntermission();
    }
  }

  // force quit - NOT send to intermission screen
  abort(data: GameData) {
    data.baseHealth = -99999;
    let socket = universal.getSocketFromConnectionID(data.owner);
    data.commands.changeScreenTo = [{ value: "mainMenu", age: 0 }];
    log.info(
      `Socket ID ${data.owner} (${universal.getNameFromConnectionID(
        data.owner
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
          `Socket ID ${connectionID} not found while eliminating it from multiplayer room, therefore skipping process.`
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

function generateEnemyWithChance(
  threshold: number,
  updateNumber: number,
  speed: number
): enemy.Enemy | null {
  let roll: number = Math.random();
  if (roll < threshold) {
    return enemy.createNew(enemy.EnemyType.NORMAL, `G${updateNumber}`, speed);
  }
  return null;
}

function processKeypressForRoom(connectionID: string, code: string) {
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
  if (inputInformation.action !== InputAction.Unknown) {
    input.processInputInformation(inputInformation, gameDataToProcess);
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

function getOpponentInformation(
  gameData: GameData,
  room: Room,
  minifyData: boolean
): any {
  let currentRoom: SingleplayerRoom | MultiplayerRoom | null =
    findRoomWithConnectionID(gameData.owner);
  let aliveConnectionIDs: Array<string> = [];
  if (typeof currentRoom === "undefined" || currentRoom == null) {
    log.warn(`Room for owner ${gameData.owner} of game data not found.`);
    return [];
  }
  let opponentGameData = currentRoom.gameData.filter(
    (element) => element.owner !== gameData.owner
  );
  // add metadata
  // ...
  // minify data
  if (minifyData) {
    let minifiedOpponentGameData = [];

    for (let singleGameData of opponentGameData) {
      let minifiedGameData: { [key: string]: any } = {};
      // let allowedKeys = Object.keys(singleGameData).filter((key) =>
      //   MINIFIED_GAME_DATA_KEYS.includes(key)
      // );
      // for (let key of allowedKeys) {
      //   minifiedGameData[key] = singleGameData[key];
      // }
      minifiedGameData.baseHealth = singleGameData.baseHealth;
      minifiedGameData.combo = singleGameData.combo;
      minifiedGameData.currentInput = singleGameData.currentInput;
      minifiedGameData.receivedEnemiesStock =
        singleGameData.receivedEnemiesStock;
      minifiedGameData.owner = singleGameData.owner;
      minifiedGameData.ownerName = singleGameData.ownerName;
      minifiedGameData.enemies = singleGameData.enemies;
      minifiedGameData.enemiesToErase = singleGameData.enemiesToErase;
      minifiedOpponentGameData.push(minifiedGameData);
      aliveConnectionIDs.push(singleGameData.owner);
    }
    // 0 base health players
    let eliminatedConnectionIDs = room.connectionIDsThisRound.filter(
      (element) =>
        aliveConnectionIDs.indexOf(element) === -1 && element !== gameData.owner
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
  room.customSettings = {};
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

export {
  SingleplayerRoom,
  MultiplayerRoom,
  Room,
  GameData,
  SingleplayerGameData,
  processKeypressForRoom,
  GameMode,
  defaultMultiplayerRoomID,
  leaveMultiplayerRoom,
  resetDefaultMultiplayerRoomID,
  MultiplayerGameData,
  getOpponentInformation
};
