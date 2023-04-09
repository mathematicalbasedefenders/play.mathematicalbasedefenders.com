import mongoose, { HydratedDocument, ObjectId } from "mongoose";

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
  safeFindByUserID(userID: string): Promise<HydratedDocument<UserInterface>>;
  getAllEasySingleplayerBestScores(): Promise<Array<object>>;
  getAllStandardSingleplayerBestScores(): Promise<Array<object>>;
  addMultiplayerGamesWonToUserID(id: string, amount: number): void;
  addMultiplayerGamesPlayedToUserID(id: string, amount: number): void;
  addGamesPlayedToUserID(id: string, amount: number): void;
  giveExperiencePointsToUserID(id: string, amount: number): void;
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

// Leaderboards

// TODO: This thing isn't DRY lol
UserSchema.static("getAllEasySingleplayerBestScores", async function () {
  let players: Array<object> = [];
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
  async function (id: string, amount: number) {
    // give experience points
    let playerData = await User.safeFindByUserID(id);
    playerData.statistics.totalExperiencePoints += Math.round(amount);
    playerData.save();
  }
);

UserSchema.static(
  "addGamesPlayedToUserID",
  async function (id: string, amount: number) {
    let playerData = await User.safeFindByUserID(id);
    playerData.statistics.gamesPlayed += amount;
    playerData.save();
  }
);

UserSchema.static(
  "addMultiplayerGamesPlayedToUserID",
  async function (id: string, amount: number) {
    let playerData = await User.safeFindByUserID(id);
    playerData.statistics.multiplayer.gamesPlayed += amount;
    playerData.save();
  }
);

UserSchema.static(
  "addMultiplayerGamesWonToUserID",
  async function (id: string, amount: number) {
    let playerData = await User.safeFindByUserID(id);
    playerData.statistics.multiplayer.gamesWon += amount;
    playerData.save();
  }
);

const User = mongoose.model<UserInterface, UserModel>(
  "User",
  UserSchema,
  "users"
);

export { User, UserInterface };
