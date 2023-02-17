import mongoose, { ObjectId } from "mongoose";

type User = {
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
};

interface UserModel extends mongoose.Model<User> {
  findByUsername(username: string): Promise<User>;
  safeFindByUsername(username: string): Promise<User>;
  safeFindByUserID(userID: string): Promise<User>;
}

const UserSchema = new mongoose.Schema<User, UserModel>({
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

const User = mongoose.model<User, UserModel>("User", UserSchema, "users");

export { User, User as UserInterface };
