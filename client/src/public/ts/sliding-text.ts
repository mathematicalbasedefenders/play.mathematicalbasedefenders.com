import * as PIXI from "pixi.js";
import { BezierCurve } from "./bezier";
import { app, playerContainer } from ".";

/**
 * Handles all SlidingText instances.
 */
class SlidingText {
  text!: string;
  textStyle!: PIXI.TextStyle;
  slideBezier!: BezierCurve;
  fadeBezier!: BezierCurve;
  rendering!: boolean;
  textSprite!: PIXI.Text;
  duration!: number;
  enemyID!: string;
  timeSinceFirstRender!: number;
  static slidingTexts: { [key: string]: SlidingText } = {};
  constructor(
    text: string,
    textStyle: PIXI.TextStyle,
    slideBezier: BezierCurve,
    fadeBezier: BezierCurve,
    duration: number,
    enemyID: string
  ) {
    this.duration = duration;
    this.text = text;
    this.textStyle = textStyle;
    this.slideBezier = slideBezier;
    this.fadeBezier = fadeBezier;
    this.rendering = false;
    this.enemyID = enemyID;
    this.textSprite = new PIXI.Text(this.text, this.textStyle);
    SlidingText.slidingTexts[enemyID] = this;
  }

  /**
   * Adds the `SlidingText`, then allows it to render (e.g. slide).
   */
  render() {
    if (this.rendering) {
      return;
    }
    playerContainer.addChild(this.textSprite);
    this.rendering = true;
    this.timeSinceFirstRender = 0;
  }

  /**
   * Destroys the `SlidingText`, and also stops it from moving.
   */
  delete() {
    playerContainer.removeChild(this.textSprite);
    this.rendering = false;
    delete SlidingText.slidingTexts[this.enemyID];
  }
}
export { SlidingText };
