import { changeScreen, renderGameData } from "./game";

interface Replay {
  ok: boolean;
  reason: string;
  data: { [key: string]: any };
}

async function fetchReplay(replayID: string) {
  const location = window.location;
  const port = location.protocol === "http:" ? ":4000" : "";
  const host = `${location.protocol}//${location.hostname}${port}/api/replays/${replayID}`;
  const data = await fetch(host);
  return data;
}

function playReplay(replayData: Replay) {
  const data = replayData.data;
  changeScreen("canvas");
  renderGameData(data.actionRecords[12]);
}

export { fetchReplay, playReplay, Replay };
