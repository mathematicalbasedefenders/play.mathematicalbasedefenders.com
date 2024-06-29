import * as universal from "../../universal";
import * as _ from "lodash";
import { log } from "../../core/log";
import { submitSingleplayerGame } from "../../services/score";
import {
  getSocketFromConnectionID,
  synchronizeGameDataWithSocket
} from "../../universal";
import {
  GameData,
  SingleplayerGameData,
  CustomSingleplayerGameData,
  GameMode
} from "../GameData";
import { updateSingleplayerRoomData } from "../actions/update";
import { createGameOverScreenText } from "../actions/create-text";
import { Room } from "./Room";

class SingleplayerRoom extends Room {
  constructor(host: universal.GameSocket, mode: GameMode, settings?: any) {
    super(host, mode);
    // custom settings
    if (typeof settings !== "undefined") {
      this.setCustomRules(settings);
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
    }

    if (this.mode === GameMode.CustomSingleplayer) {
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
    // submit score
    if (socket) {
      submitSingleplayerGame(data, socket);
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

  setCustomRules(settings: { [key: string]: any }) {
    this.customSettings = {};
    this.customSettings.baseHealth = parseFloat(settings.baseHealth);
    this.customSettings.comboTime = parseFloat(settings.comboTime);
    this.customSettings.enemySpeedCoefficient = parseFloat(
      settings.enemySpeedCoefficient
    );
    this.customSettings.enemySpawnTime = parseFloat(settings.enemySpawnTime);
    this.customSettings.enemySpawnThreshold = parseFloat(
      settings.enemySpawnChance
    );
    this.customSettings.forcedEnemySpawnTime = parseFloat(
      settings.forcedEnemySpawnTime
    );
  }
}

export { SingleplayerRoom };
