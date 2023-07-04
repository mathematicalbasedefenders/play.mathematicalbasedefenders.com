import { nCr } from "./utilities";

class BezierCurve {
  duration!: number;
  points!: Array<Array<number>>;
  constructor(duration: number, ...points: Array<Array<number>>) {
    this.duration = duration;
    this.points = points;
  }

  calculatePoint(duration: number, timeElapsed: number) {
    const curve = this;
    const terms = curve.points.length;
    const time = timeElapsed / duration;
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
