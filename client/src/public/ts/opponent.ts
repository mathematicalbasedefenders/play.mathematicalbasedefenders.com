import { app, ExtendedSprite, ExtendedText } from ".";
import * as PIXI from "pixi.js";
import {
  DEFAULT_ENEMY_HEIGHT,
  DEFAULT_ENEMY_WIDTH,
  getEnemyColor
} from "./enemies";

// TODO: find better way
const OPPONENT_INSTANCE_OFFSETS: { [key: string]: any } = {
  "sprites": {
    "playFieldBorder": {
      x: 0,
      y: 0
    }
  },
  "textSprites": {
    "statistics": {
      x: 0,
      y: 300
    },
    "input": {
      x: 0,
      y: 330
    },
    "name": {
      x: 0,
      y: 360
    }
  },
  // depends on enemies position
  "enemies": {
    x: 0,
    y: 0
  }
};

class Opponent {
  boundTo!: string;
  stageItems!: {
    sprites: { [key: string]: ExtendedSprite };
    textSprites: { [key: string]: ExtendedText };
  };
  xPositionOffset: number;
  yPositionOffset: number;
  static globalScale = 0.3;
  static instances: Array<Opponent> = [];
  constructor() {
    this.stageItems = {
      sprites: {
        playFieldBorder: new ExtendedSprite(
          PIXI.Texture.from("assets/images/playfield.png")
        )
      },
      textSprites: {
        "statistics": new ExtendedText("", {
          fontFamily: "Computer Modern Unicode Serif",
          fontSize: 20,
          fill: "#ffffff"
        }),
        "input": new ExtendedText("", {
          fontFamily: "Computer Modern Unicode Serif",
          fontSize: 20,
          fill: "#ffffff"
        }),
        "name": new ExtendedText("", {
          fontFamily: "Computer Modern Unicode Serif",
          fontSize: 20,
          fill: "#ffffff"
        })
      }
    };
    this.stageItems.sprites.playFieldBorder.scale.set(
      Opponent.globalScale,
      Opponent.globalScale
    );
    this.xPositionOffset = 0;
    this.yPositionOffset = 0;
    Opponent.instances.push(this);
  }
  bind(connectionID: string) {
    this.boundTo = connectionID;
  }
  render() {
    for (let item in this.stageItems.sprites) {
      app.stage.addChild(this.stageItems.sprites[item]);
    }
    for (let item in this.stageItems.textSprites) {
      app.stage.addChild(this.stageItems.textSprites[item]);
    }
  }
  update(data: any) {
    // sprites
    // text sprites
    this.stageItems.textSprites.statistics.text = `${
      data.baseHealth
    } ${Math.min(data.combo, 0)} ${Math.min(data.receivedEnemiesStock, 0)}`;
    this.stageItems.textSprites.input.text = `${data.currentInput}`;
    this.stageItems.textSprites.name.text = `${data.ownerName}`;
    for (let enemy of data.enemies) {
      this.updateEnemy(enemy.id, data);
    }
  }
  reposition(xPosition: number, yPosition: number) {
    this.xPositionOffset = xPosition;
    this.yPositionOffset = yPosition;
    for (let sprite in this.stageItems.sprites) {
      this.stageItems.sprites[sprite] =
        OPPONENT_INSTANCE_OFFSETS["sprites"][sprite].x + xPosition;
      this.stageItems.sprites[sprite] =
        OPPONENT_INSTANCE_OFFSETS["sprites"][sprite].y + yPosition;
    }
    for (let sprite in this.stageItems.textSprites) {
      this.stageItems.textSprites[sprite] =
        OPPONENT_INSTANCE_OFFSETS["textSprites"][sprite].x + xPosition;
      this.stageItems.textSprites[sprite] =
        OPPONENT_INSTANCE_OFFSETS["textSprites"][sprite].y + yPosition;
    }
  }
  updateEnemy(id: string, data: any) {
    if (Object.keys(this.stageItems.sprites).indexOf(`enemy${id}`) === -1) {
      // create enemy
      // TODO: temporary.
      this.stageItems.sprites[`enemy${id}`] = new ExtendedSprite(
        PIXI.Texture.WHITE
      );
      this.stageItems.sprites[`enemy${id}`].width =
        DEFAULT_ENEMY_WIDTH * Opponent.globalScale;
      this.stageItems.sprites[`enemy${id}`].height =
        DEFAULT_ENEMY_HEIGHT * Opponent.globalScale;
      this.stageItems.sprites[`enemy${id}`].tint = getEnemyColor();
      app.stage.addChild(this.stageItems.sprites[`enemy${id}`]);
    }
    let enemyData = data.enemies.find((element: any) => element.id === id);
    if (enemyData) {
      this.stageItems.sprites[`enemy${id}`].position.x =
        enemyData.xPosition * this.stageItems.sprites.playFieldBorder.width;
      this.stageItems.sprites[`enemy${id}`].position.y =
        (720 - 720 * enemyData.sPosition + 100 - 40) * Opponent.globalScale +
        this.yPositionOffset;
    }
  }
  destroyAndRender() {
    this.destroy();
    this.reposition(0, 0);
    this.render();
  }
  // this method destroys all the sprites
  destroy() {
    for (let item in this.stageItems.sprites) {
      app.stage.removeChild(this.stageItems.sprites[item]);
    }
    for (let item in this.stageItems.textSprites) {
      app.stage.removeChild(this.stageItems.sprites[item]);
    }
  }
  // TODO: add method for destroying the instance.
  // for now just delete (e.g. splice) it from the static variable instances
}

export { Opponent };
