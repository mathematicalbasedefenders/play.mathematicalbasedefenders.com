import * as PIXI from "pixi.js";
import { BezierCurve } from "./bezier";
import { app } from ".";
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
  render() {
    app.stage.addChild(this.textSprite);
    this.rendering = true;
    this.timeSinceFirstRender = 0;
  }
}
export { SlidingText };
