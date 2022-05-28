const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// const UserModelSchema = new Schema({
//     username: String,
//     usernameInAllLowercase: String,
//     emailAddress: String,
//     hashedPassword: String,
//     userNumber: Number,
//     creationDateAndTime: Date,
//     statistics: {
//         easyModePersonalBestScore: Number,
//         standardModePersonalBestScore: Number,
//         gamesPlayed: Number,
//         totalExperiencePoints: Number,
//         // TODO: Switch to this
//         personalBestScoreOnEasySingleplayerMode: {
//             score: Number,
//             timeInMilliseconds: Number,
//             scoreSubmissionDateAndTime: Date,
//             actionsPerformed: Number,
//             enemiesKilled: Number,
//             enemiesCreated: Number
//         },
//         personalBestScoreOnStandardSingleplayerMode: {
//             score: Number,
//             timeInMilliseconds: Number,
//             scoreSubmissionDateAndTime: Date,
//             actionsPerformed: Number,
//             enemiesKilled: Number,
//             enemiesCreated: Number
//         }
//     },
//     membership: {
//         isDeveloper: Boolean,
//         isAdministrator: Boolean,
//         isModerator: Boolean,
//         isContributor: Boolean,
//         isTester: Boolean,
//         isDonator: Boolean,
//         specialRank: String
//     }
// });

// const UserModel = mongoose.model("UserModel", UserModelSchema, "users");

// const EasyModeLeaderboardsSchema = new Schema({
//     rankNumber: Number,
//     userIDOfHolder: String,
//     score: Number,
//     timeInMilliseconds: Number,
//     scoreSubmissionDateAndTime: Date,
//     enemiesKilled: Number,
//     enemiesCreated: Number,
//     actionsPerformed: Number
// });

// const EasyModeLeaderboardsModel = mongoose.model(
//     "EasyModeLeaderboardsModel",
//     EasyModeLeaderboardsSchema,
//     "easyModeLeaderboardsRecords"
// );

// const StandardModeLeaderboardsSchema = new Schema({
//     rankNumber: Number,
//     userIDOfHolder: String,
//     score: Number,
//     timeInMilliseconds: Number,
//     scoreSubmissionDateAndTime: Date,
//     enemiesKilled: Number,
//     enemiesCreated: Number,
//     actionsPerformed: Number
// });

// const StandardModeLeaderboardsModel = mongoose.model(
//     "StandardModeLeaderboardsModel",
//     StandardModeLeaderboardsSchema,
//     "standardModeLeaderboardsRecords"
// );

function getUserModel() {
    return UserModel;
}

function getEasyModeLeaderboardsModel() {
    return EasyModeLeaderboardsModel;
}

function getStandardModeLeaderboardsModel() {
    return StandardModeLeaderboardsModel;
}

module.exports = {
    getUserModel,
    getEasyModeLeaderboardsModel,
    getStandardModeLeaderboardsModel
};
