import { variables } from ".";

function controlReplay(code: string) {
  switch (code) {
    case "ArrowLeft": {
      const TO_JUMP = 5 * 1000;
      const destination = Math.min(0, variables.elapsedReplayTime - TO_JUMP);
      jumpToTimeInReplay(destination);
      break;
    }
    case "ArrowRight": {
      const TO_JUMP = 5 * 1000;
      const destination = Math.max(
        variables.inGameReplayTime,
        variables.elapsedReplayTime + TO_JUMP
      );
      jumpToTimeInReplay(destination);
      break;
    }
  }
}

function jumpToTimeInReplay(destination: number) {}

export { controlReplay };
