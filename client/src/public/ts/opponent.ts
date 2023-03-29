import { app, ExtendedSprite, ExtendedText } from ".";

class Opponent {
  stageItems!: {
    sprites: { [key: string]: ExtendedSprite };
    textSprites: { [key: string]: ExtendedText };
  };
  static instances: Array<Opponent>;
  constructor() {
    Opponent.instances.push(this);
  }
  render() {
    for (let item in this.stageItems.sprites) {
      app.stage.addChild(this.stageItems.sprites[item]);
    }
    for (let item in this.stageItems.textSprites) {
      app.stage.addChild(this.stageItems.textSprites[item]);
    }
  }
  update() {
    // with what?
  }
  destroyAndRender() {
    this.destroy();
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
