import { TemplatedApp } from "uWebSockets.js";
import { createWebServer, createWebSocketServer } from "../../server/src/index";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Server } from "node:http";
import { TESTING_CONSTANTS } from "./constants";

let webServer: Server;
let webSocketServer: TemplatedApp;
let database: MongoMemoryServer;

export const mochaGlobalSetup = async () => {
  await new Promise<void>((resolve) => {
    webServer = createWebServer().listen(
      TESTING_CONSTANTS.TESTING_WEB_SERVER_PORT,
      resolve
    );
  });
  console.log(
    `Test server listening at port ${TESTING_CONSTANTS.TESTING_WEB_SERVER_PORT}`
  );

  await new Promise<void>((resolve, reject) => {
    webSocketServer = createWebSocketServer().listen(5001, (token: any) => {
      if (token) {
        console.log(
          `Test WebSockets Server listening at port ${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`
        );
        resolve();
      } else {
        console.log(
          `Failed to test WebSockets at port ${TESTING_CONSTANTS.TESTING_WEBSOCKET_SERVER_PORT}`
        );
        reject();
      }
    });
  });

  database = await MongoMemoryServer.create({
    binary: { version: "6.0.14" }
  });

  console.log(`Created test database instance.`);

  const uri = database.getUri();
  process.env.MONGO_URI = uri.slice(0, uri.lastIndexOf("/"));
};

export const mochaGlobalTeardown = async () => {
  await Promise.all([
    webServer.close(),
    webSocketServer.close(),
    database.stop()
  ]);
  console.log(`Stopped testing servers and instances.`);
};
