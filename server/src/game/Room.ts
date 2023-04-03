import * as utilities from "../core/utilities";
import * as universal from "../universal";
import * as enemy from "./Enemy";
import * as _ from "lodash";
import { log } from "../core/log";
import * as input from "../core/input";
import { submitSingleplayerGame } from "../services/score";
import { InputAction } from "../core/input";
import { findRoomWithConnectionID } from "../core/utilities";

const NO_HOST_ID = "(no host)";
const DEFAULT_MULTIPLAYER_INTERMISSION_TIME = 1000 * 10;
const MINIFIED_GAME_DATA_KEYS = [
  "baseHealth",
  "combo",
  "currentInput",
  "receivedEnemiesStock"
];
// TODO: Change design
let defaultMultiplayerRoomID: string | null = null;

enum GameMode {
  EasySingleplayer = "easySingleplayer",
  StandardSingleplayer = "standardSingleplayer",
  InsaneSingleplayer = "insaneSingleplayer",
  DefaultMultiplayer = "defaultMultiplayer",
  CustomMultiplayer = "customMultiplayer"
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
  enemiesSent!: number;
  enemiesSentStock!: number;
  opponentGameData!: Array<GameData>;
  ownerName!: string;
  // ...
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
    this.enemiesSent = 0;
    this.enemiesSentStock = 0;

    if (mode === GameMode.EasySingleplayer) {
      this.clocks = {
        enemySpawn: {
          currentTime: 0,
          actionTime: 250
        },
        comboResetTime: {
          currentTime: 0,
          actionTime: 10000
        }
      };
      this.enemySpeedCoefficient = 0.25;
      this.enemySpawnThreshold = 0.05;
    } else {
      this.clocks = {
        enemySpawn: {
          currentTime: 0,
          actionTime: 100
        },
        comboResetTime: {
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
  hostConnectionID: string;
  memberConnectionIDs: Array<string> = [];
  spectatorConnectionIDs: Array<string> = [];
  updateNumber: number = 0;
  playing: boolean = false;
  gameData: Array<GameData> = [];
  lastUpdateTime: number;
  mode!: GameMode;
  connectionIDsThisRound: Array<string> = [];
  constructor(hostConnectionID: string, gameMode: GameMode, noHost?: boolean) {
    this.mode = gameMode;
    this.id = generateRoomID(8);
    if (noHost) {
      // should only be used for default multiplayer
      this.hostConnectionID = NO_HOST_ID;
    } else {
      this.hostConnectionID = hostConnectionID;
    }
    this.connectionIDsThisRound = [];
    this.addMember(hostConnectionID);
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

  startPlay() {
    if (
      this.mode === GameMode.EasySingleplayer ||
      this.mode === GameMode.StandardSingleplayer
    ) {
      for (let member of this.memberConnectionIDs) {
        this.gameData.push(new SingleplayerGameData(member, this.mode));
      }
    } else if (
      this.mode === GameMode.DefaultMultiplayer ||
      this.mode === GameMode.CustomMultiplayer
    ) {
      for (let member of this.memberConnectionIDs) {
        this.gameData.push(new MultiplayerGameData(member, this.mode));
      }
    }
    this.connectionIDsThisRound = _.clone(this.memberConnectionIDs);
    this.playing = true;
    log.info(`Room ${this.id} has started play!`);
  }

  // TODO: Move this to singleplayer room
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
    }

    if (
      data.mode === GameMode.EasySingleplayer ||
      data.mode === GameMode.StandardSingleplayer
    ) {
      data.commands.updateText = [
        {
          selector: "#main-content__game-over-screen__stats__score",
          newText: data.score.toString()
        },
        {
          selector: "#main-content__game-over-screen__stats__game-mode",
          newText: gameMode
        },
        {
          selector: "#main-content__game-over-screen__stats__enemies",
          newText: `Enemies: ${data.enemiesKilled}/${data.enemiesSpawned} (${(
            (data.enemiesKilled / data.elapsedTime) *
            1000
          ).toFixed(3)}/s)`
        },
        {
          selector: "#main-content__game-over-screen__stats__time",
          newText: utilities.millisecondsToTime(data.elapsedTime)
        },
        {
          selector: "#main-content__game-over-screen__stats__score-rank",
          newText: messages
        }
      ];
      data.commands.changeScreenTo = "gameOver";
      // submit score
      if (socket) {
        submitSingleplayerGame(data, socket);
      }
      // destroy room somehow
      this.playing = false;
      if (socket) {
        socket?.unsubscribe(this.id);
        this.deleteMember(socket?.connectionID as string);
      }
    }
  }

  addMember(connectionID: string) {
    if (
      this.memberConnectionIDs.indexOf(connectionID) === -1 &&
      this.spectatorConnectionIDs.indexOf(connectionID) === -1
    ) {
      this.memberConnectionIDs.push(connectionID);
      log.info(
        `Added socket with connection ID ${connectionID} as a member to room ${this.id}`
      );
    }
  }

  addSpectator(connectionID: string) {
    if (
      this.spectatorConnectionIDs.indexOf(connectionID) === -1 &&
      this.memberConnectionIDs.indexOf(connectionID) === -1
    ) {
      this.spectatorConnectionIDs.push(connectionID);
      log.info(
        `Added socket with connection ID ${connectionID} as a spectator to room ${this.id}`
      );
    }
  }

  deleteMember(connectionID: string) {
    if (this.memberConnectionIDs.indexOf(connectionID) > -1) {
      this.memberConnectionIDs.splice(
        this.memberConnectionIDs.indexOf(connectionID),
        1
      );
      log.info(
        `Deleted socket with connection ID ${connectionID} (member) from room ${this.id}`
      );
    }
  }

  deleteSpectator(connectionID: string) {
    if (this.spectatorConnectionIDs.indexOf(connectionID) > -1) {
      this.spectatorConnectionIDs.splice(
        this.spectatorConnectionIDs.indexOf(connectionID),
        1
      );
      log.info(
        `Deleted socket with connection ID ${connectionID} (spectator) from room ${this.id}`
      );
    }
  }

  // delete all players, then destroy room
  destroy() {
    let members = _.clone(this.memberConnectionIDs);
    let spectators = _.clone(this.spectatorConnectionIDs);
    for (let spectator of spectators) {
      this.deleteMember(spectator);
    }
    for (let member of members) {
      this.deleteMember(member);
    }
  }
}
class SingleplayerRoom extends Room {
  constructor(hostConnectionID: string, mode: GameMode) {
    super(hostConnectionID, mode);
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
        enemy.move(0.0025 * data.enemySpeedCoefficient);
        if (enemy.sPosition <= 0) {
          enemy.remove(data, 10);
        }
      }
      if (data.baseHealth <= 0) {
        this.startGameOverProcess(data);
      }

      // clocks
      // Add enemy if generated.
      if (
        data.clocks.enemySpawn.currentTime >= data.clocks.enemySpawn.actionTime
      ) {
        enemyToAdd = generateEnemyWithChance(
          data.enemySpawnThreshold,
          this.updateNumber
        );
        data.clocks.enemySpawn.currentTime -= data.clocks.enemySpawn.actionTime;
      }
      if (
        data.clocks.comboResetTime.currentTime >=
        data.clocks.comboResetTime.actionTime
      ) {
        data.combo = -1;
        data.clocks.comboResetTime.currentTime -=
          data.clocks.comboResetTime.actionTime;
      }
      if (enemyToAdd) {
        data.enemiesSpawned++;
        data.enemies.push(_.clone(enemyToAdd as enemy.Enemy));
      }
    }
  }

  abort(data: GameData) {
    let socket = universal.getSocketFromConnectionID(data.owner);
    data.commands.changeScreenTo = "mainMenu";
    this.playing = false;
    if (socket) {
      socket?.unsubscribe(this.id);
      this.deleteMember(socket?.connectionID as string);
    }
  }
}

class MultiplayerRoom extends Room {
  nextGameStartTime!: Date | null;
  globalEnemySpawnThreshold: number;
  globalClock: ClockInterface;
  playersAtStart!: number;
  constructor(hostConnectionID: string, mode: GameMode, noHost: boolean) {
    super(hostConnectionID, mode, noHost);
    this.nextGameStartTime = null;
    this.globalEnemySpawnThreshold = 0.1;
    this.globalClock = {
      enemySpawn: {
        currentTime: 0,
        actionTime: 100
      }
    };
  }

  update(): void {
    // Update for all types of rooms
    let now: number = Date.now();
    let deltaTime: number = now - this.lastUpdateTime;
    super.update(deltaTime);
    this.lastUpdateTime = now;

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
        }
      }

      // all players
      // global - applies to all players
      let enemyToAdd = null;

      // global clocks
      this.globalClock.enemySpawn.currentTime += deltaTime;
      // Add enemy if generated.

      if (
        this.globalClock.enemySpawn.currentTime >=
        this.globalClock.enemySpawn.actionTime
      ) {
        enemyToAdd = generateEnemyWithChance(
          this.globalEnemySpawnThreshold,
          this.updateNumber
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
          enemy.move(0.0025 * data.enemySpeedCoefficient);
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
          this.eliminateSocketID(data.owner);
        }

        // clocks
        if (
          data.clocks.comboResetTime.currentTime >=
          data.clocks.comboResetTime.actionTime
        ) {
          data.combo = -1;
          data.clocks.comboResetTime.currentTime -=
            data.clocks.comboResetTime.actionTime;
        }

        // generated enemy
        if (enemyToAdd) {
          data.enemiesSpawned++;
          data.enemies.push(_.clone(enemyToAdd as enemy.Enemy));
        }

        // received enemy
        if (data.receivedEnemiesToSpawn > 0) {
          data.receivedEnemiesToSpawn--;
          data.enemiesSpawned++;
          data.enemies.push(enemy.createNewReceived(`R${data.enemiesSpawned}`));
        }

        if (data.enemiesSentStock > 0) {
          data.enemiesSentStock--;
          let targetedOpponentGameData = _.sample(opponentGameData);
          if (targetedOpponentGameData) {
            targetedOpponentGameData.receivedEnemiesStock += 1;
          }
        }
      }
    }
  }

  eliminateSocketID(connectionID: string) {
    let socket = universal.getSocketFromConnectionID(connectionID);
    if (typeof socket === "undefined") {
      log.warn(
        `Socket ID ${connectionID} not found while eliminating it from multiplayer room, but deleting anyway.`
      );
      let gameDataIndex = this.gameData.findIndex(
        (element) => element.owner === connectionID
      );
      if (gameDataIndex === -1) {
        log.warn(
          `Socket ID ${connectionID} not found while eliminating it from multiplayer room, therefore skipping process.`
        );
      }
      return;
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
      `Socket ID ${connectionID} has been eliminated from the Default Multiplayer Room`
    );
    this.checkIfGameFinished(this.gameData);
  }

  checkIfGameFinished(gameDataArray: Array<GameData>) {
    if (gameDataArray.length <= 1) {
      // game finished
      // Default Multiplayer for now since there's only 1 multiplayer room at a given time.
      log.info(`Default Multiplayer Room has finished playing.`);
      if (gameDataArray.length === 1) {
        log.info(`The winner is socket ID ${gameDataArray[0].owner}`);
      }
      // stop everyone from playing
      // bring everyone to intermission screen
      this.stopPlay();
      this.summonEveryoneToIntermission();
    }
  }

  // force quit - NOT send to intermission screen
  abort(data: GameData) {
    data.baseHealth = -99999;
    let socket = universal.getSocketFromConnectionID(data.owner);
    data.commands.changeScreenTo = "mainMenu";
    log.info(`Socket ID ${data.owner} has quit the Default Multiplayer Room`);
    if (socket) {
      socket?.unsubscribe(this.id);
      this.deleteMember(socket?.connectionID as string);
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
  updateNumber: number
): enemy.Enemy | null {
  let roll: number = Math.random();
  if (roll < threshold) {
    return enemy.createNew(enemy.EnemyType.NORMAL, `G${updateNumber}`);
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
    room.deleteMember(socket.connectionID as string);
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

function resetDefaultMultiplayerRoomID(room: string) {
  defaultMultiplayerRoomID = null;
  log.info(`Reset default multiplayer room ID from ${room} to null.`);
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
