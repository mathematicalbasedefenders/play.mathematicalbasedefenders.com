import { MongoMemoryServer } from "mongodb-memory-server";

module.exports = async function () {
  console.log("Stopping database...");
  const instance: MongoMemoryServer = (global as any).__MONGOINSTANCE;
  await instance.stop();
  console.log("Stopped database!");
};
