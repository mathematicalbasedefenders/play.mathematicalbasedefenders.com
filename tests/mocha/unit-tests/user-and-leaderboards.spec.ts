import assert from "node:assert/strict";
import mongoose from "mongoose";
import { User } from "../../../server/src/models/User";
import { getScoresOfAllPlayers } from "../../../server/src/services/leaderboards";
import { GameMode } from "../../../server/src/game/GameData";
import { createTestUser } from "../utilities";

describe("User model and leaderboards", () => {
  let databaseConnection: mongoose.Mongoose;

  before(async () => {
    databaseConnection = await mongoose.connect(process.env.MONGO_URI ?? "");
  });

  beforeEach(async () => {
    await databaseConnection.connection.db.dropDatabase();
  });

  it("excludes credentials from safe user lookups", async () => {
    const created = await createTestUser();

    const byUsername = await User.safeFindByUsername(created.username);
    const byID = await User.safeFindByUserID(created._id.toString());
    const leanedByID = (await User.safeLeanedFindByUserID(
      created._id.toString()
    )) as any;

    for (const result of [byUsername.toObject(), byID.toObject(), leanedByID]) {
      assert.equal(result.hashedPassword, undefined);
      assert.equal(result.emailAddress, undefined);
      assert.equal(result.username, created.username);
    }
  });

  it("persists experience and game counters", async () => {
    const created = await createTestUser({
      statistics: {
        gamesPlayed: 2,
        totalExperiencePoints: 10,
        multiplayer: { gamesPlayed: 3, gamesWon: 1 }
      }
    });
    const id = created._id.toString();

    await User.giveExperiencePointsToUserID(id, 2.6);
    await User.addGamesPlayedToUserID(id, 2);
    await User.addMultiplayerGamesPlayedToUserID(id, 3);
    await User.addMultiplayerGamesWonToUserID(id, 1);

    const updated = await User.safeFindByUserID(id);
    assert.equal(updated.statistics.totalExperiencePoints, 13);
    assert.equal(updated.statistics.gamesPlayed, 4);
    assert.equal(updated.statistics.multiplayer.gamesPlayed, 6);
    assert.equal(updated.statistics.multiplayer.gamesWon, 2);
  });

  it("sorts and limits Easy Singleplayer leaderboard records", async () => {
    await Promise.all([
      createTestUser({
        username: "easy-low",
        statistics: {
          personalBestScoreOnEasySingleplayerMode: { score: 100 }
        }
      }),
      createTestUser({
        username: "easy-high",
        statistics: {
          personalBestScoreOnEasySingleplayerMode: { score: 900 }
        }
      }),
      createTestUser({
        username: "easy-mid",
        statistics: {
          personalBestScoreOnEasySingleplayerMode: { score: 500 }
        }
      })
    ]);

    const records = (await User.getEasySingleplayerBestScores(2)) as any[];
    assert.deepEqual(
      records.map((record) => record.username),
      ["easy-high", "easy-mid"]
    );
  });

  it("returns the correct sorted records for each leaderboard mode", async () => {
    await Promise.all([
      createTestUser({
        username: "player-one",
        statistics: {
          personalBestScoreOnEasySingleplayerMode: { score: 800 },
          personalBestScoreOnStandardSingleplayerMode: { score: 100 }
        }
      }),
      createTestUser({
        username: "player-two",
        statistics: {
          personalBestScoreOnEasySingleplayerMode: { score: 200 },
          personalBestScoreOnStandardSingleplayerMode: { score: 900 }
        }
      })
    ]);

    const easy = (await getScoresOfAllPlayers(
      GameMode.EasySingleplayer
    )) as any[];
    const standard = (await getScoresOfAllPlayers(
      GameMode.StandardSingleplayer
    )) as any[];

    assert.deepEqual(
      easy.map((record) => record.username),
      ["player-one", "player-two"]
    );
    assert.deepEqual(
      standard.map((record) => record.username),
      ["player-two", "player-one"]
    );
  });

  after(async () => {
    await databaseConnection.connection.close();
  });
});
