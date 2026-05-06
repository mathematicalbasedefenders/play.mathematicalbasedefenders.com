function waitForWebSocketMessage(
  socket: WebSocket,
  predicate: (...args: any[]) => boolean,
  timeout = 1000
) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeEventListener("message", listener);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("WebSocket message timeout reached."));
    }, timeout);

    function listener(event: MessageEvent) {
      const message = JSON.parse(event.data);
      if (predicate(message)) {
        cleanup();
        resolve(message);
      }
    }
    socket.addEventListener("message", listener);
  });
}

export { waitForWebSocketMessage };
