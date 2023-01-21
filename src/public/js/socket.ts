// @ts-nocheck
socket.onmessage((action, arguments) => {
  switch (action) {
    case "renderGameData": {
      renderGameData();
    }
  }
});
