const { MongoClient } = require("mongodb");
const mongoose = require("mongoose");
const global = require("../../server/global.js");
const User = require("../../server/models/User.js");
const moderation = require("../../server/moderation.js");
const report = require("../../server/report.js");

// TODO: Yeah, I know that mongoosejs docs dont recommend jest for testing, but ima fix it later
// TODO: Fake sockets can't send/receive data. Fix this too. (They are just normal JavaScript objects).

describe("database: ", () => {
  let connection;
  let database;
  let fakeLoggedInUser1, fakeLoggedInUser2;
  let fakeSocketOfFakeLoggedInUser1,
    fakeSocketOfFakeLoggedInUser2,
    fakeSocketOfGuestUser1,
    fakeSocketOfGuestUser2;

  beforeAll(async () => {
    connection = await mongoose.connect(`mongodb://localhost:27017`, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    await User.createCollection();

    [fakeLoggedInUser1, fakeLoggedInUser2] = await createDummyUsers();


    [
      fakeSocketOfFakeLoggedInUser1,
      fakeSocketOfFakeLoggedInUser2,
      fakeSocketOfGuestUser1,
      fakeSocketOfGuestUser2
    ] = await createDummyFakeSockets(fakeLoggedInUser1, fakeLoggedInUser2);

    global.initialize();
    global.manuallyAddSocket(fakeSocketOfFakeLoggedInUser1);
    global.manuallyAddSocket(fakeSocketOfFakeLoggedInUser2);
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.disconnect();
  });

  test("logged in user reporting a logged in user should be registered in database", async () => {
    expect(
      await moderation.sendReport(
        fakeSocketOfFakeLoggedInUser1,
        fakeSocketOfFakeLoggedInUser2.username,
        "successful report test 1"
      )
    ).toBe(true);
  });

  test("logged in user reporting a guest user should be registered in database", async () => {
    expect(
      await moderation.sendReport(
        fakeSocketOfFakeLoggedInUser2,
        fakeSocketOfGuestUser1.username,
        "successful report test 2"
      )
    ).toBe(true);
  });

  test("guest user reporting a logged in user should not be registered in database", async () => {
    expect(
      await moderation.sendReport(
        fakeSocketOfGuestUser1,
        fakeSocketOfGuestUser2.username,
        "failed report test 1"
      )
    ).toBe(false);
  });

  test("guest user reporting a logged in user should not be registered in database", async () => {
    expect(
      await moderation.sendReport(
        fakeSocketOfGuestUser2,
        fakeSocketOfFakeLoggedInUser1.username,
        "failed report test 2"
      )
    ).toBe(false);
  });

  test("reporting user twice within 5 minutes should not be registered in database", async () => {
    await moderation.sendReport(
      fakeSocketOfFakeLoggedInUser1,
      fakeSocketOfFakeLoggedInUser2.username,
      "timed report test 1"
    );
    expect(
      await moderation.sendReport(
        fakeSocketOfFakeLoggedInUser1,
        fakeSocketOfFakeLoggedInUser2.username,
        "timed report test 2"
      )
    ).toBe(false);
  });
});

async function createDummyUsers() {
  let dummyUsers = [
    new User({
      username: "a1",
      usernameInAllLowercase: "a1"
    }),
    new User({
      username: "b2",
      usernameInAllLowercase: "b2"
    })
  ];
  for (let dummyUser of dummyUsers) {
    await dummyUser.save();
    dummyUser._id = User.findOne({username: dummyUser.username});
  }
  return dummyUsers;
}

async function createDummyFakeSockets(fakeLoggedInUser1, fakeLoggedInUser2) {
  return [
    {
      variables: {
        usernameOfSocketOwner: fakeLoggedInUser1.username,
        userIDOfSocketOwner: fakeLoggedInUser1._id,
        loggedIn: true
      }
    },
    {
      variables: {
        usernameOfSocketOwner: fakeLoggedInUser2.username,
        userIDOfSocketOwner: fakeLoggedInUser2._id,
        loggedIn: true
      }
    },
    {
      variables: {
        userIDOfSocketOwner: "testing-0001",
        loggedIn: false
      }
    },
    {
      variables: {
        userIDOfSocketOwner: "testing-0002",
        loggedIn: false
      }
    }
  ];
}
