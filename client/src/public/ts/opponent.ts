import { app, playerContainer, stageItems, textures, variables } from ".";
import * as PIXI from "pixi.js";
import {
  getScaledEnemyHeight,
  getScaledEnemyWidth,
  getSetEnemyColor
} from "./enemies";
import _ from "lodash";
import { createTextStyle } from "./utilities";
import { Container } from "pixi.js";

/**
 * This class handles opponent's game instances in Multiplayer mode.
 */
class Opponent {
  boundTo!: string;
  container: Container;
  xPositionOffset!: number;
  yPositionOffset!: number;
  instanceNumber!: number;
  nameText: PIXI.Text;
  statsText: PIXI.Text;
  static globalScale = 1 / 4;
  static instances: Array<Opponent> = [];
  // static emptyText = new PIXI.Text({
  //   text: "",
  //   style: createTextStyle({
  //     fontFamily: ["Noto Sans", "san-serif"],
  //     fontSize: 20,
  //     fill: "#ffffff"
  //   })
  // });
  // static emptyMathText = new PIXI.Text({
  //   text: "",
  //   style: createTextStyle({
  //     fontFamily: ["Computer Modern Unicode Serif", "serif"],
  //     fontSize: 20,
  //     fill: "#ffffff"
  //   })
  // });
  static textStyle = {
    fontFamily: ["Noto Sans", "san-serif"],
    fontSize: 64,
    fill: "#ffffff"
  };
  static gapWidth = 16;
  static gapHeight = 16;

  /**
   * This constructor creates a new Opponent game instance.
   */
  constructor() {
    this.instanceNumber = Opponent.instances.length;
    this.container = new Container();
    this.container.addChild(PIXI.Sprite.from(textures.playFieldBorder));

    // add text
    this.nameText = new PIXI.Text({
      text: "",
      style: createTextStyle(Opponent.textStyle)
    });
    this.nameText.y = 804 + 4 + 64;

    this.statsText = new PIXI.Text({
      text: "",
      style: createTextStyle(Opponent.textStyle)
    });
    this.statsText.y = 804;

    this.container.addChild(this.nameText);
    this.container.addChild(this.statsText);

    Opponent.instances.push(this);
    Opponent.changeGlobalScale();
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
    app.stage.addChild(this.container);
    this.autoRepositionAll();
  }

  /**
   * Writes and renders the new data.
   * @param {any} data The new data.
   */
  update(data: any) {
    this.nameText.text = data.ownerName;

    const health = data.baseHealth;
    const combo = Math.max(data.combo, 0);
    const stock = Math.max(data.receivedEnemiesStock, 0);

    this.statsText.text = `♥${health} 🡕${combo} 🞎${stock}`;
  }

  /**
   * (Attempts to) automatically reposition the Opponent game instance according to its "index".
   */
  autoReposition() {
    const position = this.getInstanceNumberPosition();
    const divisor = Math.max(
      Math.floor(Math.sqrt(Opponent.instances.length)) - 1,
      1
    );
    const playerPlayfield = playerContainer.getChildByLabel("playerPlayfield");

    if (!playerPlayfield) {
      console.error("Player's playfield not found!");
      return;
    }

    const topPlayerPlayfield = 160;
    const rightPlayerPlayfield = 640 + playerPlayfield.width;

    // ...

    this.container.x =
      rightPlayerPlayfield +
      Math.floor(position / divisor) *
        (playerPlayfield.width + Opponent.gapWidth) *
        Opponent.globalScale +
      Opponent.gapWidth +
      40;
    this.container.y =
      topPlayerPlayfield +
      (position % divisor) *
        (playerPlayfield.height + Opponent.gapHeight) *
        Opponent.globalScale +
      Opponent.gapHeight;

    console.log(
      position,
      divisor,
      this.container.x,
      this.container.y,
      Math.floor(position / divisor),
      position % divisor
    );
  }

  autoRepositionAll() {
    for (const instance of Opponent.instances) {
      instance.autoReposition();
    }
  }

  /**
   * Repositions the Opponent game instance according to its arguments (given new positions)
   * @param {number} xPosition The xPosition on the screen to reposition to.
   * @param {number} yPosition The yPosition on the screen to reposition to.
   */
  reposition(xPosition: number, yPosition: number) {}

  /**
   * Updates the enemy with the ID `id` with `data`.
   * @param {string} id The ID of the enemy to update.
   * @param {any} data The new data of the enemy.
   */
  updateEnemy(id: string, data: any) {}

  /**
   * Destroys the Opponent game instance, then renders it again.
   */
  destroyAndRender() {}

  /**
   * Destroys (removes) all the sprites of the Opponent game instance.
   */
  destroy(rescale?: boolean) {}

  /**
   * Destroys (remove) all Opponent game instances.
   * This just calls `.destroy()` on every Opponent game instance.
   */
  destroyAllInstances() {
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

  /**
   * Gets the (x, y) position (on the screen) where the Opponent game instance should be.
   * @returns The (x, y) position (on the screen) where the Opponent game instance should be.
   */
  getPositions() {}
  // TODO: add method for destroying the instance.
  // for now just delete (e.g. splice) it from the static variable instances

  static changeGlobalScale() {
    const initialScale = 1 / 3;
    const ratio = 4 / 5;
    const exponent = Math.max(
      Math.floor(Math.sqrt(Opponent.instances.length)) - 1,
      1
    );
    Opponent.globalScale = initialScale * ratio ** exponent;
    for (const instance of Opponent.instances) {
      instance.setScale();
    }
  }

  setScale() {
    this.container.scale.set(Opponent.globalScale, Opponent.globalScale);
  }
}

export { Opponent };
