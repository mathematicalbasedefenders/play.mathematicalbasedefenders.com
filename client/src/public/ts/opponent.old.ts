import { app, stageItems, variables } from ".";
import * as PIXI from "pixi.js";
import {
  getScaledEnemyHeight,
  getScaledEnemyWidth,
  getSetEnemyColor
} from "./enemies";
import _ from "lodash";
import { createTextStyle } from "./utilities";

/**
 * This class handles opponent's game instances in Multiplayer mode.
 */
class Opponent {
  boundTo!: string;
  stageItems!: {
    sprites: { [key: string]: PIXI.Sprite };
    textSprites: { [key: string]: PIXI.Text };
  };
  xPositionOffset: number;
  yPositionOffset: number;
  instanceNumber: number;
  static globalScale = 1 / 4;
  static instances: Array<Opponent> = [];

  /**
   * This constructor creates a new Opponent game instance.
   */
  constructor() {
    const emptyText = new PIXI.Text({
      text: "",
      style: createTextStyle({
        fontFamily: ["Noto Sans", "san-serif"],
        fontSize: 20,
        fill: "#ffffff"
      })
    });
    const emptyMathText = new PIXI.Text({
      text: "",
      style: createTextStyle({
        fontFamily: ["Computer Modern Unicode Serif", "serif"],
        fontSize: 20,
        fill: "#ffffff"
      })
    });
    this.stageItems = {
      sprites: {
        "playfieldBorder": new PIXI.Sprite(
          PIXI.Texture.from("assets/images/playfield.png")
        )
      },
      textSprites: {
        "statistics": _.cloneDeep(emptyText),
        "input": _.cloneDeep(emptyMathText),
        "name": _.cloneDeep(emptyText)
      }
    };
    this.stageItems.sprites.playfieldBorder.scale.set(
      Opponent.globalScale,
      Opponent.globalScale
    );
    this.instanceNumber = Opponent.instances.length;
    this.xPositionOffset = 0;
    this.yPositionOffset = 0;
    Opponent.changeGlobalScale();
    Opponent.instances.push(this);
  }

  /**
   * Binds the Opponent game instance to a connectionID.
   * Usually when getting data from the server the connectionID would also be keyed so the client can differentiate who is who.
   * @param {string} connectionID The connectionID this Opponent game instance is bound to.
   */
  bind(connectionID: string) {
    this.boundTo = connectionID;
  }

  /**
   * Renders the Opponent game instance with respect to its position.
   */
  render() {
    for (const item in this.stageItems.sprites) {
      app.stage.addChild(this.stageItems.sprites[item]);
    }
    for (const item in this.stageItems.textSprites) {
      app.stage.addChild(this.stageItems.textSprites[item]);
    }
    const xPosition =
      stageItems.sprites["playfieldBorder"].position.x +
      stageItems.sprites["playfieldBorder"].width +
      variables.opponentInstancePositions.x.initial +
      variables.opponentInstancePositions.x.increment *
        Math.floor(
          this.getInstanceNumberPosition() /
            variables.opponentInstancesPerColumn
        );
    const yPosition =
      variables.opponentInstancePositions.y.initial +
      variables.opponentInstancePositions.y.increment *
        (this.getInstanceNumberPosition() %
          variables.opponentInstancesPerColumn);
    this.reposition(xPosition, yPosition);
  }

  /**
   * Writes and renders the new data.
   * @param {any} data The new data.
   */
  update(data: any) {
    this.stageItems.textSprites.statistics.text = `♥${
      data.baseHealth
    } ${Math.max(data.combo, 0)}C ${Math.max(data.receivedEnemiesStock, 0)}ST`;
    this.stageItems.textSprites.input.text = `${data.currentInput || ""}`;
    this.stageItems.textSprites.name.text = `${data.ownerName}`;
    for (const enemy of data.enemies) {
      this.updateEnemy(enemy.id, data);
    }
    const enemyToDeleteMatches = data.enemiesToErase;
    for (const enemyID of enemyToDeleteMatches) {
      let enemyToDelete = this.stageItems.sprites[`enemy${enemyID}`];
      if (enemyToDelete) {
        app.stage.removeChild(enemyToDelete);
      }
    }
  }

  /**
   * (Attempts to) automatically reposition the Opponent game instance according to its "index".
   */
  autoReposition() {
    const position = this.getInstanceNumberPosition();
    this.reposition(
      stageItems.sprites["playfieldBorder"].position.x +
        stageItems.sprites["playfieldBorder"].width +
        variables.opponentInstancePositions.x.initial +
        variables.opponentInstancePositions.x.increment *
          Math.floor(position / variables.opponentInstancesPerColumn),
      variables.opponentInstancePositions.y.initial +
        variables.opponentInstancePositions.y.increment *
          Math.floor(position % variables.opponentInstancesPerColumn)
    );
  }

  /**
   * Repositions the Opponent game instance according to its arguments (given new positions)
   * @param {number} xPosition The xPosition on the screen to reposition too.
   * @param {number} yPosition The yPosition on the screen to reposition too.
   */
  reposition(xPosition: number, yPosition: number) {
    this.xPositionOffset = xPosition;
    this.yPositionOffset = yPosition;
    let instanceOffsets = this.getPositions();
    for (const sprite in this.stageItems.sprites) {
      if (sprite.indexOf("enemy") > -1) {
        continue;
      }

      if (this.stageItems.sprites[sprite]) {
        this.stageItems.sprites[sprite].x =
          instanceOffsets["sprites"][sprite].x + xPosition;
        this.stageItems.sprites[sprite].y =
          instanceOffsets["sprites"][sprite].y + yPosition;
      }
    }
    for (let sprite in this.stageItems.textSprites) {
      if (this.stageItems.textSprites[sprite]) {
        this.stageItems.textSprites[sprite].x =
          instanceOffsets["textSprites"][sprite].x + xPosition;
        this.stageItems.textSprites[sprite].y =
          instanceOffsets["textSprites"][sprite].y + yPosition;
      }
    }

    const centered = ["statistics", "input", "name"];
    for (let element of centered) {
      this.stageItems.textSprites[element].anchor.set(0.5, 0.5);
    }
  }

  /**
   * Updates the enemy with the ID `id` with `data`.
   * @param {string} id The ID of the enemy to update.
   * @param {any} data The new data of the enemy.
   */
  updateEnemy(id: string, data: any) {
    // create enemy if none exists
    if (Object.keys(this.stageItems.sprites).indexOf(`enemy${id}`) === -1) {
      // create enemy
      // TODO: temporary.
      this.stageItems.sprites[`enemy${id}`] = new PIXI.Sprite(
        PIXI.Texture.WHITE
      );
      this.stageItems.sprites[`enemy${id}`].width =
        getScaledEnemyWidth() * (getScaledEnemyWidth() / 640);
      this.stageItems.sprites[`enemy${id}`].height =
        getScaledEnemyHeight() * (getScaledEnemyHeight() / 640);
      this.stageItems.sprites[`enemy${id}`].tint = getSetEnemyColor();
      app.stage.addChild(this.stageItems.sprites[`enemy${id}`]);
    }
    const enemyData = data.enemies.find((element: any) => element.id === id);
    if (enemyData) {
      let enemyRealPosition =
        enemyData.xPosition *
        (this.stageItems.sprites["playfieldBorder"].width -
          this.stageItems.sprites[`enemy${id}`].width);

      this.stageItems.sprites[`enemy${id}`].position.x =
        this.stageItems.sprites["playfieldBorder"].position.x +
        enemyRealPosition;

      this.stageItems.sprites[`enemy${id}`].position.y =
        (720 - 720 * enemyData.sPosition + 100 - 40 - getScaledEnemyHeight()) *
          Opponent.globalScale +
        this.yPositionOffset;
    }
  }

  /**
   * Destroys the Opponent game instance, then renders it again.
   */
  destroyAndRender() {
    this.destroy();
    // this.reposition(0, 0);
    this.render();
  }

  /**
   * Destroys (removes) all the sprites of the Opponent game instance.
   */
  destroy(rescale?: boolean) {
    for (const item in this.stageItems.sprites) {
      app.stage.removeChild(this.stageItems.sprites[item]);
    }
    for (const item in this.stageItems.textSprites) {
      app.stage.removeChild(this.stageItems.textSprites[item]);
    }

    if (rescale) {
      Opponent.changeGlobalScale();
    }
  }

  /**
   * Destroys (remove) all Opponent game instances.
   * This just calls `.destroy()` on every Opponent game instance.
   */
  destroyAllInstances() {
    //CLEAR
    for (let instance of Opponent.instances) {
      instance.destroy();
    }
    Opponent.instances = [];
  }

  /**
   * Gets the position (not index) of the Opponent game instance.
   * @returns The position (not index) of the Opponent game instance.
   */
  getInstanceNumberPosition() {
    // CLEAR
    // sort all instances, then find index
    // lowest index comes first, then higher
    // made to fill in "blank spaces"
    // TODO: might need caching so this doesn't get called every update
    const sorted = Opponent.instances.sort(
      (a, b) => a.instanceNumber - b.instanceNumber
    );
    return sorted.findIndex(
      (element) => element.instanceNumber === this.instanceNumber
    );
  }

  /**
   * Gets the (x, y) position (on the screen) where the Opponent game instance should be.
   * @returns The (x, y) position (on the screen) where the Opponent game instance should be.
   */
  getPositions() {
    const data: { [key: string]: any } = {
      "sprites": {
        "playfieldBorder": {
          x: 0,
          y: 0
        }
      },
      "textSprites": {
        "statistics": {
          x: this.stageItems.sprites["playfieldBorder"].width / 2,
          y: 240 + 16
        },
        "input": {
          x: this.stageItems.sprites["playfieldBorder"].width / 2,
          y: 240 + 40
        },
        "name": {
          x: this.stageItems.sprites["playfieldBorder"].width / 2,
          y: 240 + 64
        }
      },
      // depends on enemies position
      "enemies": {
        x: 0,
        y: 0
      }
    };
    return data;
  }
  // TODO: add method for destroying the instance.
  // for now just delete (e.g. splice) it from the static variable instances

  static changeGlobalScale() {
    // CLEAR
    const initialScale = 1 / 4;
    const ratio = 2 / 3;
    const exponent = Math.min(
      Math.floor(Math.sqrt(Opponent.instances.length)) - 1,
      1
    );
    Opponent.globalScale = initialScale * ratio ** exponent;
    for (const instance of Opponent.instances) {
      instance.setScale();
    }
  }

  setScale() {
    // CLEAR
    this.stageItems.sprites.playfieldBorder.scale.set(
      Opponent.globalScale,
      Opponent.globalScale
    );
  }
}

export { Opponent };
