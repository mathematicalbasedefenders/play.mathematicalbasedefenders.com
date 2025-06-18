import { variables } from ".";

function controlReplay(code: string) {
  switch (code) {
    case "ArrowLeft": {
      const TO_JUMP = 5 * 1000;
      const destination = Math.max(0, variables.elapsedReplayTime - TO_JUMP);
      variables.elapsedReplayTime = destination;
      console.log("new destination after -5", destination);
      jumpToTimeInReplay(destination);
      break;
    }
    case "ArrowRight": {
      const TO_JUMP = 5 * 1000;
      const destination = Math.max(
        variables.inGameReplayTime,
        variables.elapsedReplayTime + TO_JUMP
      );
      console.log("new destination after +5", destination);
      variables.elapsedReplayTime = destination;
      jumpToTimeInReplay(destination);
      break;
    }
  }
}

/**
 * Jumps to a specific replay time on a replay.
 * @param {number} destination The time since start in milliseconds.
 */
function jumpToTimeInReplay(destination: number) {
  variables.elapsedReplayTime = destination;
}

export { controlReplay };
