const mongoose = require("mongoose");
const _ = require("lodash");
const log = require("../core/log.js");

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

EasyModeLeaderboardsSchema.statics.findByRankSlot = async function (rank) {
  try {
    return await this.find({ rankNumber: rank }, function (error2, result2) {
      if (error2) {
        console.error(log.addMetadata(error2.stack, "error"));
      }
      return result2;
    }).clone();
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

EasyModeLeaderboardsSchema.statics.findAndUpdateByRankSlot = async function (
  rank,
  data
) {
  try {
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
  } catch (error) {
    console.error(log.addMetadata(error.stack, "error"));
  }
};

module.exports = mongoose.model(
  "EasyModeLeaderboardsModel",
  EasyModeLeaderboardsSchema,
  "easyModeLeaderboardsRecords"
);
