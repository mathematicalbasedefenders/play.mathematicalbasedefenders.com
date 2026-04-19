require("wtfnode").init();

import mongoose from "mongoose";
import { createWebServer, createWebSocketServer } from "../../server/src/index";
import { MongoMemoryServer } from "mongodb-memory-server";

module.exports = async function () {
  const TESTING_WEB_SERVER_PORT = 4001;
  const TESTING_WEBSOCKET_SERVER_PORT = 5001;

  console.log("Creating test web server...");

  const webServer = createWebServer();
  (globalThis as any).webServer = webServer.listen(TESTING_WEB_SERVER_PORT);

  console.log("Created test web server!");

  console.log("Creating test WebSocket server!");

  const webSocketServer = createWebSocketServer();
  (globalThis as any).webSocketServer = webSocketServer.listen(
    TESTING_WEBSOCKET_SERVER_PORT,
    (token: any) => {
      if (token) {
        (globalThis as any).webSocketServerToken = token;
        console.log(
          `Test WebSockets Server listening at port ${TESTING_WEBSOCKET_SERVER_PORT}`
        );
      } else {
        console.log(
          `Failed to test WebSockets at port ${TESTING_WEBSOCKET_SERVER_PORT}`
        );
      }
    }
  );

  console.log("Created test WebSocket server!");

  const instance = await MongoMemoryServer.create({
    binary: { version: "6.0.14" }
  });
  const uri = instance.getUri();
  (globalThis as any).__MONGOINSTANCE = instance;
  process.env.MONGO_URI = uri.slice(0, uri.lastIndexOf("/"));
  const connection = await mongoose.connect(process.env["MONGO_URI"] as string);
  await connection.connection.db.dropDatabase();
  await mongoose.disconnect();
};
