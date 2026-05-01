module.exports = async function () {
  console.log("Shutting down test web server...");
  await (globalThis as any).webServer.close();
  console.log("Shut down test web server!");

  console.log("Shutting down test WebSocket server...");
  await (globalThis as any).webSocketServer.close();
  console.log("Shut down test WebSocket server!");

  const instance = (globalThis as any).__MONGOINSTANCE;
  instance.stop();
};
