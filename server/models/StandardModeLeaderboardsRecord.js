const mongoose = require("mongoose");

const StandardModeLeaderboardsSchema = new mongoose.Schema({
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
    "StandardModeLeaderboardsModel",
    StandardModeLeaderboardsSchema,
    "standardModeLeaderboardsRecords"
);