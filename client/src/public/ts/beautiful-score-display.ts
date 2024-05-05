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
  const DURATION = 1500;
  const previous =
    variables.currentGameClientSide.beautifulScoreDisplayPrevious;
  // planned bezier (0,0,.6,1)
  const CURVE = new BezierCurve(DURATION, [0, 0], [0, 0], [0.6, 1], [1, 1]);

  if (progress >= DURATION) {
    stageItems.textSprites.scoreText.text =
      variables.currentGameClientSide.shownScore;
    return;
  }

  const position = CURVE.calculatePoint(progress).y;
  const result = previous + (goal - previous) * position;
  const toShow = Math.max(previous, result);

  stageItems.textSprites.scoreText.text = Math.round(toShow);

  variables.currentGameClientSide.beautifulScoreDisplayPrevious = Math.round(
    parseInt(stageItems.textSprites.scoreText.text)
  );
}

export { renderBeautifulScoreDisplay };
