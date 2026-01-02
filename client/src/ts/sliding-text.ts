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

  /**
   * Gets or create a SlidingText instance.
   * Gets it if it already exists for the enemyID.
   * Creates a new one if it doesn't exist for the enemyID.
   * @returns A SlidingText instance, new if it hasn't existed for the enemyID before.
   */
  static getOrCreate(
    text: string,
    textStyle: TextStyle,
    slideBezier: BezierCurve,
    fadeBezier: BezierCurve,
    duration: number,
    enemyID: string
  ): SlidingText {
    return (
      SlidingText.slidingTexts[enemyID] ??
      new SlidingText(
        text,
        textStyle,
        slideBezier,
        fadeBezier,
        duration,
        enemyID
      )
    );
  }
}
export { SlidingText };
