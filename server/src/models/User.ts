import mongoose, { HydratedDocument, ObjectId } from "mongoose";
import _ from "lodash";
import { log } from "../core/log";
interface UserInterface {
  _id: ObjectId;
  username: string;
  usernameInAllLowercase: string;
  emailAddress: string;
  hashedPassword: string;
  userNumber: number;
  creationDateAndTime: Date;
  statistics: {
    easyModePersonalBestScore: number;
    standardModePersonalBestScore: number;
    gamesPlayed: number;
    totalExperiencePoints: number;
    personalBestScoreOnEasySingleplayerMode: {
      score: number;
      timeInMilliseconds: number;
      scoreSubmissionDateAndTime: Date;
      actionsPerformed: number;
      enemiesKilled: number;
      enemiesCreated: number;
    };
    personalBestScoreOnStandardSingleplayerMode: {
      score: number;
      timeInMilliseconds: number;
      scoreSubmissionDateAndTime: Date;
      actionsPerformed: number;
      enemiesKilled: number;
      enemiesCreated: number;
    };
    multiplayer: {
      gamesPlayed: number;
      gamesWon: number;
    };
  };
  membership: {
    isDeveloper: boolean;
    isAdministrator: boolean;
    isModerator: boolean;
    isContributor: boolean;
    isTester: boolean;
    isDonator: boolean;
    specialRank: string;
  };
}

interface UserModel extends mongoose.Model<UserInterface> {
  findByUsername(username: string): Promise<HydratedDocument<UserInterface>>;
  safeFindByUsername(
    username: string
  ): Promise<HydratedDocument<UserInterface>>;
  findByUserIDUsingAPI(userID: string): Promise<UserInterface>;
  safeFindByUserID(userID: string): Promise<HydratedDocument<UserInterface>>;
  safeLeanedFindByUserID(userID: string): Promise<object>;
  getAllEasySingleplayerBestScores(): Promise<Array<object>>;
  getAllStandardSingleplayerBestScores(): Promise<Array<object>>;
  addMultiplayerGamesWonToUserID(userID: string, amount: number): void;
  addMultiplayerGamesPlayedToUserID(userID: string, amount: number): void;
  addGamesPlayedToUserID(userID: string, amount: number): void;
  giveExperiencePointsToUserID(userID: string, amount: number): void;
  addMissingKeys(id: string): void;
}

const UserSchema = new mongoose.Schema<UserInterface, UserModel>({
  username: String,
  usernameInAllLowercase: String,
  emailAddress: String,
  hashedPassword: String,
  userNumber: Number,
  creationDateAndTime: Date,
  statistics: {
    easyModePersonalBestScore: Number,
    standardModePersonalBestScore: Number,
    gamesPlayed: Number,
    totalExperiencePoints: Number,
    personalBestScoreOnEasySingleplayerMode: {
      score: Number,
      timeInMilliseconds: Number,
      scoreSubmissionDateAndTime: Date,
      actionsPerformed: Number,
      enemiesKilled: Number,
      enemiesCreated: Number
    },
    personalBestScoreOnStandardSingleplayerMode: {
      score: Number,
      timeInMilliseconds: Number,
      scoreSubmissionDateAndTime: Date,
      actionsPerformed: Number,
      enemiesKilled: Number,
      enemiesCreated: Number
    },
    multiplayer: {
      gamesPlayed: Number,
      gamesWon: Number
    }
  },
  membership: {
    isDeveloper: Boolean,
    isAdministrator: Boolean,
    isModerator: Boolean,
    isContributor: Boolean,
    isTester: Boolean,
    isDonator: Boolean,
    specialRank: String
  }
});

UserSchema.static("findByUsername", async function (username: string) {
  return this.findOne({ username: username })
    .select({
      emailAddress: 0
    })
    .clone();
});

UserSchema.static("safeFindByUsername", async function (username: string) {
  return this.findOne({ username: username })
    .select({
      email: 0,
      emailAddress: 0,
      hashedPassword: 0
    })
    .clone();
});

UserSchema.static("safeFindByUserID", async function (userID: string) {
  return this.findOne({ _id: userID })
    .select({
      emailAddress: 0,
      hashedPassword: 0
    })
    .clone();
});

UserSchema.static("safeLeanedFindByUserID", async function (userID: string) {
  return this.findOne({ _id: userID })
    .select({
      emailAddress: 0,
      hashedPassword: 0
    })
    .clone()
    .lean(true);
});

// Leaderboards

// TODO: This thing isn't DRY lol
UserSchema.static("getAllEasySingleplayerBestScores", async function () {
  let loaded: Array<object> = [];
  let cursor = this.find({})
    .select({
      _id: 1,
      "username": 1,
      "statistics.personalBestScoreOnEasySingleplayerMode": 1
    })
    .clone()
    .lean(true)
    .cursor();
  for await (let player of cursor) {
    loaded.push(player);
  }
  return loaded;
});

UserSchema.static("getAllStandardSingleplayerBestScores", async function () {
  let players: Array<object> = [];
  let loaded: Array<object> = [];
  let cursor = this.find({})
    .select({
      _id: 1,
      "username": 1,
      "statistics.personalBestScoreOnStandardSingleplayerMode": 1
    })
    .clone()
    .lean(true)
    .cursor();
  for await (let player of cursor) {
    loaded.push(player);
  }
  return loaded;
});

UserSchema.static(
  "giveExperiencePointsToUserID",
  async function (userID: string, amount: number) {
    // give experience points
    let playerData = await User.safeFindByUserID(userID);
    playerData.statistics.totalExperiencePoints += Math.round(amount);
    log.info(`Adding ${amount} EXP to User ID ${userID}`);
    await playerData.save();
    log.info(`Successfully updated player data in database.`);
  }
);

UserSchema.static(
  "addGamesPlayedToUserID",
  async function (userID: string, amount: number) {
    let playerData = await User.safeFindByUserID(userID);
    playerData.statistics.gamesPlayed += amount;
    log.info(`Adding ${amount} games played to User ID ${userID}`);
    await playerData.save();
    log.info(`Successfully updated player data in database.`);
  }
);

UserSchema.static(
  "addMultiplayerGamesPlayedToUserID",
  async function (userID: string, amount: number) {
    let playerData = await User.safeFindByUserID(userID);
    playerData.statistics.multiplayer.gamesPlayed += amount;
    log.info(`Adding ${amount} multiplayer games played to User ID ${userID}`);
    await playerData.save();
    log.info(`Successfully updated player data in database.`);
  }
);

UserSchema.static(
  "addMultiplayerGamesWonToUserID",
  async function (userID: string, amount: number) {
    let playerData = await User.safeFindByUserID(userID);
    playerData.statistics.multiplayer.gamesWon += amount;
    log.info(`Adding ${amount} multiplayer games won to User ID ${userID}`);
    await playerData.save();
    log.info(`Successfully updated player data in database.`);
  }
);

UserSchema.static("addMissingKeys", async function (id: string) {
  let playerData = await User.safeFindByUserID(id);
  let playerDataKeys: any = _.cloneDeep(await User.safeLeanedFindByUserID(id));
  let keysAdded = 0;
  const properties = Object.keys(UserSchema.paths);
  for (const property of properties) {
    // debug
    // add everything that aren't personal bests
    const statKey = property.startsWith("statistics");
    const nonPBKey = !(property.indexOf("personalBest") > -1);
    if (
      statKey &&
      nonPBKey &&
      (_.get(playerDataKeys, property) === null ||
        _.get(playerDataKeys, property) === undefined)
    ) {
      keysAdded++;
      await User.updateOne({ _id: id }, { [property]: 0 });
    }
  }
  await playerData.save();
  log.info(`Added ${keysAdded} keys to User ID ${id}.`);
});

UserSchema.static("findByUserIDUsingAPI", async function (userID: string) {
  const userIDRegex = /^[0-9a-f]{24}$/;
  if (!userIDRegex.test(userID)) {
    log.warn(`Invalid user ID for in-game API fetch: ${userID}`);
    return {};
  }
  return this.findOne({ _id: userID })
    .select({
      username: 1,
      creationDateAndTime: 1,
      statistics: 1,
      membership: 1
    })
    .maxTimeMS(5000)
    .clone()
    .catch((error) => {
      log.error(
        `Database error when looking up user ${userID}: ${error.message}`
      );
      return {};
    });
});

const User = mongoose.model<UserInterface, UserModel>(
  "User",
  UserSchema,
  "users"
);

export { User, UserInterface };
