import { changeScreen } from "./game";

interface Replay {
  ok: boolean;
  reason: string;
  data: { [key: string]: unknown };
}

async function fetchReplay(replayID: string) {
  const url = `/api/replay/${replayID}`;
  const data = await fetch(url);
  return data;
}

function playReplay(replayData: Replay) {
  const data = replayData.data;
  changeScreen("canvas");
}

export { fetchReplay, playReplay, Replay };
