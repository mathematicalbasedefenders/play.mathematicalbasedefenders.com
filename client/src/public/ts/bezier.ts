import { nCr } from "./utilities";

/**
 * This represents a Bezier curve.
 * This is currently used for sliding text.
 */
class BezierCurve {
  duration!: number;
  points!: Array<Array<number>>;

  /**
   * Creates a new bezier curve. These will be updated on every render.
   * @param {number} duration The duration of the curve.
   * @param {Array<Array<number>>} points The points of the curve.
   */
  constructor(duration: number, ...points: Array<Array<number>>) {
    this.duration = duration;
    this.points = points;
  }

  /**
   * Calculates the point for a bezier curve.
   * @param {number} timeElapsed The time elapsed.
   * @returns An object with keys x and y, for the points in the curve.
   */
  calculatePoint(timeElapsed: number) {
    const curve = this;
    const terms = curve.points.length;
    const time = timeElapsed / curve.duration;
    let x = 0,
      y = 0;
    for (let i = 0; i < terms; i++) {
      x +=
        nCr(terms - 1, i) *
        (1 - time) ** (terms - i - 1) *
        time ** i *
        curve.points[i][0];
      y +=
        nCr(terms - 1, i) *
        (1 - time) ** (terms - i - 1) *
        time ** i *
        curve.points[i][1];
    }
    return {
      x: x,
      y: y
    };
  }
}

export { BezierCurve };
