import { MongoMemoryServer } from "mongodb-memory-server";
import * as mongoose from "mongoose";

module.exports = async function () {
  console.log("Creating database...");

  const instance = await MongoMemoryServer.create({
    binary: { version: "6.0.14" }
  });
  const uri = instance.getUri();
  (global as any).__MONGOINSTANCE = instance;
  process.env.MONGO_URI = uri.slice(0, uri.lastIndexOf("/"));

  // The following is to make sure the database is clean before a test suite starts
  const conn = await mongoose.connect(`${process.env.MONGO_URI}/mbd-testing`);
  await conn.connection.db.dropDatabase();
  await mongoose.disconnect();

  console.log("Created database...");
};
