function waitForWebSocketMessage(
  socket: WebSocket,
  predicate: (...args: any[]) => boolean,
  timeout = 1000
) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeEventListener("message", listener);
      reject(new Error("WebSocket message timeout reached."));
    }, timeout);

    function listener(event: MessageEvent) {
      const message = JSON.parse(event.data);
      if (predicate(message)) {
        clearTimeout(timer);
        resolve(message);
      }
    }
    socket.addEventListener("message", (event) => {
      listener(event);
    });
  });
}

export { waitForWebSocketMessage };
