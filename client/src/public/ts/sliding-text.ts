import { BezierCurve } from "./bezier";
import { app, playerContainer } from ".";
import { TextStyle, Text } from "pixi.js";

/**
 * Handles all SlidingText instances.
 */
class SlidingText {
  text!: string;
  textStyle!: TextStyle;
  slideBezier!: BezierCurve;
  fadeBezier!: BezierCurve;
  rendering!: boolean;
  textSprite!: Text;
  duration!: number;
  enemyID!: string;
  timeSinceFirstRender!: number;
  static slidingTexts: { [key: string]: SlidingText } = {};
  constructor(
    text: string,
    textStyle: TextStyle,
    slideBezier: BezierCurve,
    fadeBezier: BezierCurve,
    duration: number,
    enemyID: string
  ) {
    // use the sliding text if it already exists
    if (Object.keys(SlidingText.slidingTexts).includes(enemyID)) {
      return SlidingText.slidingTexts[enemyID];
    }

    this.duration = duration;
    this.text = text;
    this.textStyle = textStyle;
    this.slideBezier = slideBezier;
    this.fadeBezier = fadeBezier;
    this.rendering = false;
    this.enemyID = enemyID;
    this.textSprite = new Text({ text: this.text, style: this.textStyle });
    SlidingText.slidingTexts[enemyID] = this;
  }

  /**
   * Adds the `SlidingText`, then allows it to render (e.g. slide).
   */
  render() {
    if (this.rendering) {
      return;
    }
    this.rendering = true;
    this.timeSinceFirstRender = 0;
    const point = this.slideBezier.calculatePoint(0);
    this.textSprite.x = point.x;
    this.textSprite.y = point.y;
    playerContainer.addChild(this.textSprite);
  }

  /**
   * Destroys the `SlidingText`, and also stops it from moving.
   */
  delete() {
    playerContainer.removeChild(this.textSprite);
    this.textSprite.destroy();
    this.rendering = false;
    delete SlidingText.slidingTexts[this.enemyID];
  }
}
export { SlidingText };
