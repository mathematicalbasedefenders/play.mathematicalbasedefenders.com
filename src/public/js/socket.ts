// @ts-nocheck
socket.addEventListener("message", (event: string) => {
  let message: object = JSON.parse(event.data);
  switch (message.message) {
    case "renderGameData": {
      renderGameData(message.arguments);
    }
  }
});
