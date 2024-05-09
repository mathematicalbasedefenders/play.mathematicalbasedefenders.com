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
    stageItems.textSprites.scoreText.text =
      variables.currentGameClientSide.shownScore;
    variables.currentGameClientSide.beautifulScoreDisplayPrevious = Math.round(
      parseInt(stageItems.textSprites.scoreText.text, 10)
    );
    return;
  }

  const position = CURVE.calculatePoint(progress).y;
  const result = previous + (goal - previous) * position;
  const toShow = Math.max(previous, result);

  stageItems.textSprites.scoreText.text = Math.round(toShow);
}

export { renderBeautifulScoreDisplay };
