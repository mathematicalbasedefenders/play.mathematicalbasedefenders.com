import { app, ExtendedSprite, ExtendedText, stageItems, variables } from ".";
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
      y: 240 + 16
    },
    "input": {
      x: 0,
      y: 240 + 40
    },
    "name": {
      x: 0,
      y: 240 + 64
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
  instanceNumber: number;
  static globalScale = 0.3;
  static instances: Array<Opponent> = [];
  constructor() {
    this.stageItems = {
      sprites: {
        "playFieldBorder": new ExtendedSprite(
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
    this.instanceNumber = Opponent.instances.length;
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
    let xPosition =
      stageItems.sprites["playFieldBorder"].position.x +
      stageItems.sprites["playFieldBorder"].width +
      variables.enemyInstancePositions.x.initial +
      variables.enemyInstancePositions.x.increment *
        Math.floor(
          this.getInstanceNumberPosition() / variables.enemyInstancesPerColumn
        );
    let yPosition =
      variables.enemyInstancePositions.y.initial +
      variables.enemyInstancePositions.y.increment *
        (this.getInstanceNumberPosition() % variables.enemyInstancesPerColumn);
    this.reposition(xPosition, yPosition);
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
    let enemyToDeleteMatches = data.enemiesToErase;
    for (let enemyID of enemyToDeleteMatches) {
      let enemyToDelete = this.stageItems.sprites[`enemy${enemyID}`];
      if (enemyToDelete) {
        app.stage.removeChild(enemyToDelete);
      }
    }
  }
  reposition(xPosition: number, yPosition: number) {
    this.xPositionOffset = xPosition;
    this.yPositionOffset = yPosition;
    for (let sprite in this.stageItems.sprites) {
      if (sprite.indexOf("enemy") > -1) {
        // this.stageItems.sprites[sprite].x =
        //   OPPONENT_INSTANCE_OFFSETS["enemies"].x + xPosition;
        // this.stageItems.sprites[sprite].y =
        //   OPPONENT_INSTANCE_OFFSETS["enemies"].y + yPosition;
        continue;
      }

      if (this.stageItems.sprites[sprite]) {
        this.stageItems.sprites[sprite].x =
          OPPONENT_INSTANCE_OFFSETS["sprites"][sprite].x + xPosition;
        this.stageItems.sprites[sprite].y =
          OPPONENT_INSTANCE_OFFSETS["sprites"][sprite].y + yPosition;
      }
    }
    for (let sprite in this.stageItems.textSprites) {
      if (this.stageItems.textSprites[sprite]) {
        this.stageItems.textSprites[sprite].x =
          OPPONENT_INSTANCE_OFFSETS["textSprites"][sprite].x + xPosition;
        this.stageItems.textSprites[sprite].y =
          OPPONENT_INSTANCE_OFFSETS["textSprites"][sprite].y + yPosition;
      }
    }
  }
  updateEnemy(id: string, data: any) {
    // create enemy if none exists
    if (Object.keys(this.stageItems.sprites).indexOf(`enemy${id}`) === -1) {
      // create enemy
      // TODO: temporary.
      this.stageItems.sprites[`enemy${id}`] = new ExtendedSprite(
        PIXI.Texture.WHITE
      );
      this.stageItems.sprites[`enemy${id}`].width =
        DEFAULT_ENEMY_WIDTH * (DEFAULT_ENEMY_WIDTH / Math.min(640, 800));
      this.stageItems.sprites[`enemy${id}`].height =
        DEFAULT_ENEMY_HEIGHT * (DEFAULT_ENEMY_HEIGHT / Math.min(800, 640));
      this.stageItems.sprites[`enemy${id}`].tint = getEnemyColor();
      app.stage.addChild(this.stageItems.sprites[`enemy${id}`]);
    }
    let enemyData = data.enemies.find((element: any) => element.id === id);
    if (enemyData) {
      let enemyRealPosition =
        enemyData.xPosition *
        (this.stageItems.sprites["playFieldBorder"].width -
          this.stageItems.sprites[`enemy${id}`].width);

      this.stageItems.sprites[`enemy${id}`].position.x =
        this.stageItems.sprites["playFieldBorder"].position.x +
        enemyRealPosition;

      this.stageItems.sprites[`enemy${id}`].position.y =
        (720 - 720 * enemyData.sPosition + 100 - 40 - DEFAULT_ENEMY_HEIGHT) *
          Opponent.globalScale +
        this.yPositionOffset;
    }
  }
  destroyAndRender() {
    this.destroy();
    // this.reposition(0, 0);
    this.render();
  }
  // this method destroys all the sprites
  destroy() {
    for (let item in this.stageItems.sprites) {
      app.stage.removeChild(this.stageItems.sprites[item]);
    }
    for (let item in this.stageItems.textSprites) {
      app.stage.removeChild(this.stageItems.textSprites[item]);
    }
  }
  destroyAllInstances() {
    for (let instance of Opponent.instances) {
      instance.destroy();
    }
    Opponent.instances = [];
  }
  getInstanceNumberPosition() {
    // sort all instances, then find index
    // lowest index comes first, then higher
    // made to fill in "blank spaces"
    // TODO: might need caching so this doesn't get called every update
    let sorted = Opponent.instances.sort(
      (a, b) => a.instanceNumber - b.instanceNumber
    );
    return sorted.findIndex(
      (element) => element.instanceNumber === this.instanceNumber
    );
  }
  // TODO: add method for destroying the instance.
  // for now just delete (e.g. splice) it from the static variable instances
}

export { Opponent };
