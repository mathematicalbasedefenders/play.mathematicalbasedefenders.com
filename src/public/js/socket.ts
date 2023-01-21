// @ts-nocheck
socket.addEventListener("message", (event: string) => {
  let message: string = JSON.parse(event.data);
  switch (message.message) {
    case "renderGameData": {
      // renderGameData();
      $("#stats").text(
        `${message.arguments[0]}ms, ${message.arguments[1]} players.`
      );
    }
  }
});
