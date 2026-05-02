import { TemplatedApp } from "uWebSockets.js";
import { createWebServer, createWebSocketServer } from "../../server/src/index";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Server } from "node:http";
import { TESTING_CONSTANTS } from "./constants";

let webServer: Server;
let webSocketServer: TemplatedApp;
let database: MongoMemoryServer;

export const mochaGlobalSetup = async () => {
  webServer = createWebServer().listen(
    TESTING_CONSTANTS.TESTING_WEB_SERVER_PORT
  );
  console.log(
    `Test server listening at port ${TESTING_CONSTANTS.TESTING_WEB_SERVER_PORT}`
  );

  webSocketServer = createWebSocketServer().listen(5001, (token: any) => {
    if (token) {
      console.log(
        `Test WebSockets Server listening at port ${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`
      );
    } else {
      console.log(
        `Failed to test WebSockets at port ${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`
      );
    }
  });

  database = await MongoMemoryServer.create({
    binary: { version: "6.0.14" }
  });
  const uri = database.getUri();
  process.env.MONGO_URI = uri.slice(0, uri.lastIndexOf("/"));
};

export const mochaGlobalTeardown = async () => {
  webServer.close();
  console.log(`Stopped test server.`);
  webSocketServer.close();
  console.log(`Stopped test WebSocket server.`);
  database.stop();
  console.log(`Stopped in-memory database instance.`);
};
