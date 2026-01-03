import { log } from "../core/log";
import {
  getUserReplayDataFromSocket,
  convertGameSettingsToReplayActions
} from "../core/utilities";
import { Action } from "../replay/recording/ActionRecord";
import { submitSingleplayerGame } from "../services/score";
import {
  getSocketFromConnectionID,
  synchronizeGameDataWithSocket,
  UserData
} from "../universal";
import { createGameOverScreenText } from "./actions/create-text";
import { updateSingleplayerRoomData } from "./actions/update";
import {
  SingleplayerGameData,
  CustomSingleplayerGameData,
  GameData
} from "./GameData";
import { GameMode, Room } from "./Room";
import * as universal from "../universal";

class SingleplayerRoom extends Room {
  constructor(
    host: universal.WebSocket<UserData>,
    mode: GameMode,
    settings?: any
  ) {
    super(host, mode);
    // custom settings
    if (typeof settings !== "undefined") {
      this.setCustomSingleplayerRoomRules(settings);
    }
  }

  startPlay() {
    this.gameActionRecord.initialize();

    if (
      this.mode === GameMode.EasySingleplayer ||
      this.mode === GameMode.StandardSingleplayer
    ) {
      for (let member of this.memberConnectionIDs) {
        const socket = getSocketFromConnectionID(member);
        if (!socket) {
          continue;
        }
        this.gameData.push(new SingleplayerGameData(socket, this.mode));
      }
    } else if (this.mode === GameMode.CustomSingleplayer) {
      for (let member of this.memberConnectionIDs) {
        const socket = getSocketFromConnectionID(member);
        if (!socket) {
          continue;
        }
        this.gameData.push(
          new CustomSingleplayerGameData(socket, this.mode, this.customSettings)
        );
      }
    }

    // add players (and maybe spectators) to record
    for (let member of this.memberConnectionIDs) {
      const socket = getSocketFromConnectionID(member);
      if (!socket) {
        continue;
      }
      this.gameActionRecord.addAction({
        scope: "room",
        action: Action.AddUser,
        timestamp: Date.now(),
        data: {
          playerAdded: getUserReplayDataFromSocket(socket)
        }
      });
    }

    // check for validity
    if (this.gameData.length === 0) {
      log.error(`Room ${this.id} started without any initialized GameData!`);
      this.updating = false;
      return;
    }

    // add game settings
    const gameSettings = convertGameSettingsToReplayActions(this.gameData[0]);
    for (const setting in gameSettings) {
      this.gameActionRecord.addSetGameDataAction(
        this.gameData[0],
        "player",
        setting,
        gameSettings[setting]
      );
    }

    this.updating = true;

    // It's the first element of the array because spectators aren't implemented yet.
    // TODO: Do something when spectators get implemented
    this.gameActionRecord.owner = getSocketFromConnectionID(
      this.memberConnectionIDs[0]
    );

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
      //TODO: Implement anticheat
      submitSingleplayerGame(data, socket, this.gameActionRecord);
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

    if (!data) {
      log.error("No/empty/invalid data value found when updating game data!");
      return;
    }

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

  /**
   * Sets the custom rules to this room.
   * @param {any} settings The settings to set this room to.
   */
  setCustomSingleplayerRoomRules(settings: { [key: string]: any }) {
    this.customSettings = {
      baseHealth: 100,
      comboTime: 5000,
      enemySpeedCoefficient: 1,
      enemySpawnThreshold: 0.1,
      enemySpawnTime: 100,
      forcedEnemySpawnTime: 2500
    };
    if (!Number.isNaN(Number(settings.baseHealth))) {
      this.customSettings.baseHealth = parseFloat(settings.baseHealth);
    }
    if (!Number.isNaN(Number(settings.comboTime))) {
      this.customSettings.comboTime = parseFloat(settings.comboTime);
    }
    if (!Number.isNaN(Number(settings.enemySpeedCoefficient))) {
      this.customSettings.enemySpeedCoefficient = parseFloat(
        settings.enemySpeedCoefficient
      );
    }
    if (!Number.isNaN(Number(settings.enemySpawnTime))) {
      this.customSettings.enemySpawnTime = parseFloat(settings.enemySpawnTime);
    }
    if (!Number.isNaN(Number(settings.enemySpawnThreshold))) {
      this.customSettings.enemySpawnThreshold = parseFloat(
        settings.enemySpawnThreshold
      );
    }
    if (!Number.isNaN(Number(settings.forcedEnemySpawnTime))) {
      this.customSettings.forcedEnemySpawnTime = parseFloat(
        settings.forcedEnemySpawnTime
      );
    }
  }
}

/**
 * Creates a new singleplayer room.
 * @param {universal.WebSocket<UserData>} caller The socket that called the function
 * @param {GameMode} gameMode The singleplayer game mode.
 * @param {settings} settings The `settings` for the singleplayer game mode, if it's custom.
 * @returns The newly-created room object.
 */
function createSingleplayerRoom(
  caller: universal.WebSocket<UserData>,
  gameMode: GameMode,
  settings?: { [key: string]: string }
): SingleplayerRoom {
  const room = new SingleplayerRoom(caller, gameMode, settings);
  universal.rooms.push(room);
  return room;
}

export { createSingleplayerRoom, SingleplayerRoom };
