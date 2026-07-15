import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { GameActionRecord } from "../../../server/src/models/GameActionRecord";
import * as universal from "../../../server/src/universal";
import {
  createTestUser,
  objectID,
  openTestSocket,
  requestJSON
} from "../utilities";
import { TESTING_CONSTANTS } from "../constants";

describe("HTTP API", () => {
  let databaseConnection: mongoose.Mongoose;

  before(async () => {
    databaseConnection = await mongoose.connect(process.env.MONGO_URI ?? "");
  });

  beforeEach(async () => {
    (globalThis as any).sockets = [];
    (globalThis as any).rooms = [];
    universal.STATUS.databaseAvailable = true;
    await databaseConnection.connection.db.dropDatabase();
  });

  describe("POST /api/authenticate", () => {
    it("authenticates valid credentials for an opening-screen socket", async () => {
      await createTestUser({
        hashedPassword: await bcrypt.hash(
          TESTING_CONSTANTS.TESTING_USER_PASSWORD,
          4
        )
      });
      const { socket, connectionID } = await openTestSocket();

      try {
        const { response, body } = await requestJSON("/api/authenticate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: TESTING_CONSTANTS.TESTING_USER_USERNAME,
            password: TESTING_CONSTANTS.TESTING_USER_PASSWORD,
            socketID: connectionID
          })
        });

        assert.equal(response.status, 200);
        assert.deepEqual(body, { success: true, error: "None" });
      } finally {
        socket.close();
      }
    });

    it("returns an unsuccessful response for an incorrect password", async () => {
      await createTestUser({
        hashedPassword: await bcrypt.hash(
          TESTING_CONSTANTS.TESTING_USER_PASSWORD,
          4
        )
      });
      const { socket, connectionID } = await openTestSocket();

      try {
        const { response, body } = await requestJSON("/api/authenticate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: TESTING_CONSTANTS.TESTING_USER_USERNAME,
            password: "incorrect-password",
            socketID: connectionID
          })
        });

        assert.equal(response.status, 200);
        assert.deepEqual(body, { success: false, error: "None" });
      } finally {
        socket.close();
      }
    });

    for (const testCase of [
      {
        name: "missing required fields",
        body: { username: "test_user1" },
        error: "Missing required fields"
      },
      {
        name: "incorrect field types",
        body: { username: 123, password: "password", socketID: "x" },
        error: "Invalid field types"
      },
      {
        name: "invalid field lengths",
        body: { username: "ab", password: "password", socketID: "x" },
        error: "Invalid field lengths"
      }
    ]) {
      it(`rejects ${testCase.name}`, async () => {
        const { response, body } = await requestJSON("/api/authenticate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(testCase.body)
        });

        assert.equal(response.status, 400);
        assert.deepEqual(body, { success: false, error: testCase.error });
      });
    }
  });

  describe("GET /api/users/:user", () => {
    it("returns public user data without credentials", async () => {
      const user = await createTestUser();
      const { response, body } = await requestJSON(`/api/users/${user._id}`);

      assert.equal(response.status, 200);
      assert.equal(body.username, TESTING_CONSTANTS.TESTING_USER_USERNAME);
      assert.equal(body.hashedPassword, undefined);
      assert.equal(body.emailAddress, undefined);
      assert.equal(body.statistics.gamesPlayed, 0);
      assert.equal(body.membership.isDeveloper, false);
    });

    it("rejects a malformed user ID", async () => {
      const { response, body } = await requestJSON("/api/users/not-valid!");

      assert.equal(response.status, 400);
      assert.deepEqual(body, { error: "Invalid user parameter for lookup." });
    });

    it("rejects a well-formed user ID that does not exist", async () => {
      const { response } = await requestJSON(`/api/users/${objectID()}`);
      assert.equal(response.status, 400);
    });
  });

  describe("GET /api/replays/:replayID", () => {
    it("returns a stored replay in the API envelope", async () => {
      const replay = await GameActionRecord.create({
        actionRecords: [
          { scope: "room", action: "gameStart", timestamp: 100, data: {} }
        ],
        recordingVersion: 1,
        gameVersion: "test-version",
        owner: objectID(),
        name: "Test replay",
        mode: "easySingleplayer",
        timestamp: new Date("2024-01-01T00:00:00.000Z"),
        statistics: {
          singleplayer: {
            score: 1234,
            timeInMilliseconds: 5000,
            scoreSubmissionDateAndTime: new Date(
              "2024-01-01T00:00:00.000Z"
            ),
            actionsPerformed: 20,
            enemiesKilled: 10,
            enemiesCreated: 12
          }
        }
      });

      const { response, body } = await requestJSON(
        `/api/replays/${replay._id}`
      );

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.reason, "Successful");
      assert.equal(body.data._id, replay._id.toString());
      assert.equal(body.data.statistics.singleplayer.score, 1234);
      assert.equal(body.data.actionRecords[0].action, "gameStart");
    });

    it("rejects a malformed replay ID", async () => {
      const { response, body } = await requestJSON("/api/replays/not-valid");

      assert.equal(response.status, 400);
      assert.deepEqual(body, { ok: false, reason: "Replay ID invalid." });
    });

    it("returns 404 for a replay that does not exist", async () => {
      const id = objectID();
      const { response, body } = await requestJSON(`/api/replays/${id}`);

      assert.equal(response.status, 404);
      assert.equal(body.ok, false);
      assert.match(body.reason, new RegExp(id.toString()));
    });
  });

  after(async () => {
    await databaseConnection.connection.close();
  });
});
