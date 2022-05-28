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
        isBanned: Boolean,
        isMuted: Boolean,
    }
});

UserModelSchema.statics.safeFindByUsername = function (username) {
    return this.findOne({ username: username }).select({
        emailAddress: 0,
        hashedPassword: 0
    });
};

UserModelSchema.statics.findByUsername = function (username) {
    return this.findOne({ username: username });
};

UserModelSchema.statics.safeFindByUserNumber = function (userNumber) {
    return this.findOne(
        { userNumber: userNumber }.select({
            emailAddress: 0,
            hashedPassword: 0
        })
    );
};

UserModelSchema.statics.findByUserNumber = function (userNumber) {
    return this.findOne({ userNumber: userNumber });
};

UserModelSchema.statics.safeFindByUserID = function (userID) {
    return this.findById(userID)
        .select({
            emailAddress: 0,
            hashedPassword: 0
        });
};

UserModelSchema.statics.giveExperiencePointsToUserID = function (
    userID,
    amount
) {
    this.findByIdAndUpdate(
        userID,
        { $inc: { "statistics.totalExperiencePoints": amount } },
        { upsert: true },
        (error, data) => {
            if (error) {
                console.error(log.addMetadata(error.stack, "error"));
            }
        }
    );
};

UserModelSchema.statics.setNewPersonalBestForUserID = function (
    userID,
    gameMode,
    finalGameData
) {
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

    this.findByIdAndUpdate(
        userID,
        {
            $set: {
                [`statistics.${fieldToUpdate}`]: {
                    score: finalGameData.currentScore,
                    timeInMilliseconds:
                        finalGameData.currentInGameTimeInMilliseconds,
                    scoreSubmissionDateAndTime:
                        finalGameData.scoreSubmissionDateAndTime,
                    actionsPerformed: finalGameData.actionsPerformed,
                    enemiesKilled: finalGameData.enemiesKilled,
                    enemiesCreated: finalGameData.enemiesCreated
                }
            }
        },
        { upsert: true },
        (error, data) => {
            if (error) {
                console.error(log.addMetadata(error.stack, "error"));
            }
        }
    );
};

module.exports = mongoose.model("UserModel", UserModelSchema, "users");
