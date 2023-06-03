// import { User } from "../../server/src/models/User";
// import { authenticate } from "../../server/src/authentication/authenticate";
// import * as universal from "../../server/src/universal";
// import uWS from "uWebSockets.js";
// const testUser = new User({
//   username: "Ad123",
//   usernameInAllLowercase: "ad123",
//   // password12345678 salted 8 times hashed
//   password: "$2b$08$0gYM0R5QUBNqiMQ3ak9cEOlkh69yhKDr4p2MZf5TxF5GqTBiodUeS"
// });
// const testSocket: universal.GameSocket = {};
// describe("Authentication service", () => {
//   beforeAll(async () => {
//     universal.sockets.push(testSocket);
//     testUser.save();
//   });

//   it("should allow regular users to log in", async () => {
//     authenticate("Ad123", "password12345678", "", true);
//   });
// });
