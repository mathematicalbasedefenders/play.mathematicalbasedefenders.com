async function fetchReplay(replayID: string) {
  const url = `/api/replay${replayID}`;
  const data = await fetch(url);
}

export { fetchReplay };
