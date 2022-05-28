const mongoose = require("mongoose");

const EasyModeLeaderboardsSchema = new mongoose.Schema({
    rankNumber: Number,
    userIDOfHolder: String,
    score: Number,
    timeInMilliseconds: Number,
    scoreSubmissionDateAndTime: Date,
    enemiesKilled: Number,
    enemiesCreated: Number,
    actionsPerformed: Number
});

module.exports = mongoose.model(
    "EasyModeLeaderboardsModel",
    EasyModeLeaderboardsSchema,
    "easyModeLeaderboardsRecords"
);