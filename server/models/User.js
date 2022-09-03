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
            gamesWon: Number,
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
        isMuted: Boolean,
    }
});

UserModelSchema.statics.safeFindByUsername = async function (username) {
    return await this.findOne({ username: username }).select({
        emailAddress: 0,
        hashedPassword: 0
    }).clone();
};

UserModelSchema.statics.findByUsername = async function (username) {
    return await this.findOne({ username: username }).clone();
};

UserModelSchema.statics.superSafeFindByUsername = async function (username){
    return await this.findOne({ username: username}).select({
        username: 1,
        creationDateAndTime: 1,
        statistics: 1,
        membership: 1
    }).clone();
}


UserModelSchema.statics.superSafeFindByUserNumber = async function (userID){
return await this.findOne({  _id: userID} ).select({
    username: 1,
    creationDateAndTime: 1,
    statistics: 1,
    membership: 1
}).clone();
}

UserModelSchema.statics.safeFindByUserNumber = async function (userNumber) {
    return await this.findOne(
        { userNumber: userNumber }.select({
            emailAddress: 0,
            hashedPassword: 0
        })
    ).clone();
};

UserModelSchema.statics.findByUserNumber = async function (userNumber) {
    return await this.findOne({ userNumber: userNumber }).clone();
};

UserModelSchema.statics.safeFindByUserID = async function (userID) {
    return await this.findById(userID)
        .select({
            emailAddress: 0,
            hashedPassword: 0
        }).clone();
};

UserModelSchema.statics.giveExperiencePointsToUserID = async function (
    userID,
    amount
) {
    return await this.findByIdAndUpdate(
        userID,
        { $inc: { "statistics.totalExperiencePoints": amount } },
        { upsert: true }
    ).clone();
};

UserModelSchema.statics.setLastReportTimeForUserID = async function (
    userID
) {
    return await this.findByIdAndUpdate(
        userID,
        { $set: { "moderation.timeLastReportFiled": Date.now() } },
        { upsert: true }
    ).clone();
};

UserModelSchema.statics.setNewPersonalBestForUserID = async function (
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

    return await this.findByIdAndUpdate(
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
        { upsert: true }
    ).clone();
};

UserModelSchema.statics.incrementMultiplayerGamesPlayedCount = async function(userID, amount=1){
    console.debug(`+${amount} game played for player ${userID}`)
    return await this.findByIdAndUpdate(
        userID,
        { $inc: { "statistics.multiplayer.gamesPlayed": 1 } },
        { upsert: true },
    ).clone().exec();
}

UserModelSchema.statics.incrementMultiplayerGamesWonCount = async function(userID, amount=1){
    return await this.findByIdAndUpdate(
        userID,
        { $inc: { "statistics.multiplayer.gamesWon": amount } },
        { upsert: true },
    ).clone().exec();
}

module.exports = mongoose.model("UserModel", UserModelSchema, "users");
