interface Replay {
  ok: boolean;
  reason: string;
  data: { [key: string]: unknown };
}

async function fetchReplay(replayID: string) {
  const url = `/api/replay${replayID}`;
  const data = await fetch(url);
  return data;
}

function playReplay(replayData: Replay) {
  const data = replayData.data;
}

export { fetchReplay, playReplay, Replay };
