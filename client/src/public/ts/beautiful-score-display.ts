import { stageItems, variables } from ".";
import { BezierCurve } from "./bezier";

/**
 * This works by finding where the `CURVE` is currently at
 * `variables.currentGameClientSide.beautifulScoreDisplayProgress`
 * then deriving the position from `start` to `goal`.
 */
function renderBeautifulScoreDisplay() {
  const progress =
    variables.currentGameClientSide.beautifulScoreDisplayProgress;
  const goal = variables.currentGameClientSide.beautifulScoreDisplayGoal;
  const DURATION = 1000;
  const previous =
    variables.currentGameClientSide.beautifulScoreDisplayPrevious;
  // planned bezier (0,0,.6,1)
  // current bezier: https://easings.co/, easeOutCubic
  const CURVE = new BezierCurve(
    DURATION,
    [0, 0],
    [0.22, 0.61],
    [0.36, 1],
    [1, 1]
  );

  if (progress >= DURATION) {
    const shown = variables.currentGameClientSide.shownScore;
    stageItems.textSprites.scoreText.text = shown.toLocaleString("en-US");
    variables.currentGameClientSide.beautifulScoreDisplayPrevious = Math.round(
      Number.parseInt(shown, 10)
    );
    return;
  }

  const position = CURVE.calculatePoint(progress).y;
  const result = previous + (goal - previous) * position;
  const toShow = Math.max(previous, result);

  if (isNaN(toShow)) {
    stageItems.textSprites.scoreText.text = "0";
  } else {
    stageItems.textSprites.scoreText.text =
      Number.parseInt(toShow.toString()).toLocaleString("en-US") || "0";
  }
}

export { renderBeautifulScoreDisplay };
