const mongoose = require("mongoose");

const _ = require("lodash");
const log = require("../core/log.js");

const UserModelSchema = new mongoose.Schema({
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
    // TODO: Switch to this
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
  },
  moderation: {
    timeLastReportFiled: Date,
    isBanned: Boolean,
    isMuted: Boolean
  }
});

UserModelSchema.statics.safeFindByUsername = async function (username) {
  try {
    return await this.findOne({ username: username })
      .select({
        emailAddress: 0,
        hashedPassword: 0
      })
      .clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.findByUsername = async function (username) {
  try {
    return await this.findOne({ username: username }).clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.superSafeFindByUsername = async function (username) {
  try {
    return await this.findOne({ username: username })
      .select({
        username: 1,
        creationDateAndTime: 1,
        statistics: 1,
        membership: 1
      })
      .clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.superSafeFindByUserID = async function (userID) {
  try {
    return await this.findOne({ _id: userID })
      .select({
        username: 1,
        creationDateAndTime: 1,
        statistics: 1,
        membership: 1
      })
      .clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.safeFindByUserNumber = async function (userNumber) {
  try {
    return await this.findOne(
      { userNumber: userNumber }.select({
        emailAddress: 0,
        hashedPassword: 0
      })
    ).clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.findByUserNumber = async function (userNumber) {
  try {
    return await this.findOne({ userNumber: userNumber }).clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.safeFindByUserID = async function (userID) {
  try {
    return await this.findById(userID)
      .select({
        emailAddress: 0,
        hashedPassword: 0
      })
      .clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.giveExperiencePointsToUserID = async function (
  userID,
  amount
) {
  try {
    return await this.findByIdAndUpdate(
      userID,
      { $inc: { "statistics.totalExperiencePoints": amount } },
      { upsert: true }
    ).clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.setLastReportTimeForUserID = async function (userID) {
  try {
    return await this.findByIdAndUpdate(
      userID,
      { $set: { "moderation.timeLastReportFiled": Date.now() } },
      { upsert: true }
    ).clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.setNewPersonalBestForUserID = async function (
  userID,
  gameMode,
  finalGameData
) {
  let fieldToUpdate;
  if (gameMode == "easySingleplayerMode") {
    fieldToUpdate = "personalBestScoreOnEasySingleplayerMode";
  } else if (gameMode == "standardSingleplayerMode") {
    fieldToUpdate = "personalBestScoreOnStandardSingleplayerMode";
  } else {
    console.error(
      log.addMetadata(
        `${gameMode} is not a valid Singleplayer game mode!`,
        "error"
      )
    );
    return;
  }

  try {
    return await this.findByIdAndUpdate(
      userID,
      {
        $set: {
          [`statistics.${fieldToUpdate}`]: {
            score: finalGameData.currentScore,
            timeInMilliseconds: finalGameData.currentInGameTimeInMilliseconds,
            scoreSubmissionDateAndTime:
              finalGameData.scoreSubmissionDateAndTime,
            actionsPerformed: finalGameData.actionsPerformed,
            enemiesKilled: finalGameData.enemiesKilled,
            enemiesCreated: finalGameData.enemiesCreated
          }
        }
      },
      { upsert: true }
    ).clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.incrementMultiplayerGamesPlayedCount = async function (
  userID,
  amount = 1
) {
  try {
    return await this.findByIdAndUpdate(
      userID,
      { $inc: { "statistics.multiplayer.gamesPlayed": 1 } },
      { upsert: true }
    ).clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

UserModelSchema.statics.incrementMultiplayerGamesWonCount = async function (
  userID,
  amount = 1
) {
  try {
    return await this.findByIdAndUpdate(
      userID,
      { $inc: { "statistics.multiplayer.gamesWon": amount } },
      { upsert: true }
    ).clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

module.exports = mongoose.model("UserModel", UserModelSchema, "users");
