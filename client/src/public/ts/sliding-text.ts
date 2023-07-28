import * as PIXI from "pixi.js";
import { BezierCurve } from "./bezier";
import { app } from ".";

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
  timeSinceFirstRender!: number;
  static slidingTexts: Array<SlidingText> = [];
  constructor(
    text: string,
    textStyle: PIXI.TextStyle,
    slideBezier: BezierCurve,
    fadeBezier: BezierCurve,
    duration: number
  ) {
    this.duration = duration;
    this.text = text;
    this.textStyle = textStyle;
    this.slideBezier = slideBezier;
    this.fadeBezier = fadeBezier;
    this.rendering = false;
    this.textSprite = new PIXI.Text(this.text, this.textStyle);
    SlidingText.slidingTexts.push(this);
  }

  /**
   * Adds the `SlidingText`, then allows it to render (e.g. slide).
   */
  render() {
    app.stage.addChild(this.textSprite);
    this.rendering = true;
    this.timeSinceFirstRender = 0;
  }

  /**
   * Destroys the `SlidingText`, and also stops it from moving.
   */
  delete() {
    app.stage.removeChild(this.textSprite);
    this.rendering = false;
    SlidingText.slidingTexts.splice(SlidingText.slidingTexts.indexOf(this), 1);
  }
}
export { SlidingText };
