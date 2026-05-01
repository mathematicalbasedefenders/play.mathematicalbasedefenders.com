import mongoose from "mongoose";
import { User } from "../../server/src/models/User";
import * as universal from "../../server/src/universal";
const bcrypt = require("bcrypt");

const TESTING_CONSTANTS = {
  TESTING_USER_USERNAME: "test_user1",
  TESTING_USER_PASSWORD: "test_user1",
  TESTING_WEB_SERVER_PORT: 4001,
  TESTING_WEBSOCKET_SERVER_PORT: 5001,
  WEBSOCKET_UPDATE_DELAY_TIME: 17
};

jest.mock("isomorphic-dompurify", () => ({
  sanitize: (input: string) => input
}));

beforeAll(async () => {
  // connect to database
  await mongoose.connect(process.env["MONGO_URI"] as string);
  mongoose.connection.on("connected", () => {
    console.log(`Connected to test database!`);
  });
  universal.STATUS.databaseAvailable = true;

  // add test user
  const user = new User();
  user.username = TESTING_CONSTANTS.TESTING_USER_USERNAME;
  user.hashedPassword = await bcrypt.hash(
    TESTING_CONSTANTS.TESTING_USER_PASSWORD,
    4
  );
  await user.save();
});

afterAll(async () => {
  await mongoose.connection.close();
});

export { TESTING_CONSTANTS };
