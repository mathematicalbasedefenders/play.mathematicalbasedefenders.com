const mongoose = require("mongoose");
const _ = require("lodash");
const log = require("../core/log.js");

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

StandardModeLeaderboardsSchema.statics.findByRankSlot = async function(rank){
    return await this.find(
        { rankNumber: rank },
        function (error2, result2) {
            if (error2) {
                console.error(log.addMetadata(error2.stack, "error"));
            }
            return result2;
        }
    ).clone();
}

StandardModeLeaderboardsSchema.statics.findAndUpdateByRankSlot = async function(rank, data){
    return await this.findOneAndUpdate(
        { rankNumber: rank },
        data,
        function (error2, result2) {
            if (error2) {
                console.error(log.addMetadata(error2.stack, "error"));
            }
            return result2;
        }
    ).clone();
}

module.exports = mongoose.model(
    "StandardModeLeaderboardsModel",
    StandardModeLeaderboardsSchema,
    "standardModeLeaderboardsRecords"
);