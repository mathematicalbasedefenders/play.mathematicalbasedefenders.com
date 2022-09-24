const mongoose = require("mongoose");
const log = require("../core/log.js");
const global = require("../global.js");

// models
var User = require("../models/User.js");
var EasyModeLeaderboardsRecord = require("../models/EasyModeLeaderboardsRecord.js");
var StandardModeLeaderboardsRecord = require("../models/StandardModeLeaderboardsRecord.js");

/**
 * Checks the leaderboards to see if any changes are to be make according to the newly submitted game.
 * @param {*} userIDAsString
 * @param {*} finalGameData
 * @param {*} gameMode
 * @param {*} usernameOfSocketOwner
 * @returns -1 if player did not get Top 50, their rank number otherwise.
 */
async function checkAndModifyLeaderboards(
  userIDAsString,
  finalGameData,
  gameMode,
  usernameOfSocketOwner,
  playerDataOfSocketOwner
) {
  var placePlayerRanked = -1;
  var placePlayerRankedBefore = -1;
  let leaderboardsModel;
  let score = finalGameData.currentScore;
  let timeInMilliseconds = finalGameData.currentInGameTimeInMilliseconds;

  if (gameMode == "easySingleplayerMode") {
    leaderboardsModel = EasyModeLeaderboardsRecord;
  } else if (gameMode == "standardSingleplayerMode") {
    leaderboardsModel = StandardModeLeaderboardsRecord;
  } else {
    console.error(
      log.addMetadata(
        `${gameMode} is not a valid Singleplayer game mode!`,
        "error"
      )
    );
    return;
  }
  // main check #1
  for (let i = 1; i <= 50; i++) {
    let data = await leaderboardsModel
      .find({ rankNumber: i }, function (error2, result2) {
        if (error2) {
          console.error(log.addMetadata(error2.stack, "error"));
        }
        return result2;
      })
      .clone();

    if (score > data[0].score) {
      placePlayerRanked = i;
      break;
    }
  }

  if (placePlayerRanked == -1) {
    return -1;
  }
  // main check #2
  for (let i = 1; i < placePlayerRanked; i++) {
    let data = await leaderboardsModel
      .find({ rankNumber: i }, function (error2, result2) {
        if (error2) {
          console.error(log.addMetadata(error2.stack, "error"));
        }
        return result2;
      })
      .clone();

    if (userIDAsString == data[0].userIDOfHolder) {
      return placePlayerRanked;
    }
  }
  // middle check #1
  // check if player is already on leaderboard but at a lower rank
  for (let i = placePlayerRanked; i <= 50; i++) {
    let data = await leaderboardsModel
      .find({ rankNumber: i }, function (error2, result2) {
        if (error2) {
          console.error(log.addMetadata(error2.stack, "error"));
        }
        return result2;
      })
      .clone();
    if (userIDAsString == data[0].userIDOfHolder) {
      placePlayerRankedBefore = i;
      break;
    }
  }
  // TODO: Find out what this does.
  // My guess would be this pushes the ??? down
  if (placePlayerRankedBefore != -1) {
    for (let i = placePlayerRankedBefore; i < 50; i++) {
      let data1 = await leaderboardsModel
        .findOne({ rankNumber: i + 1 })
        .clone();
      await leaderboardsModel
        .findOneAndUpdate(
          { rankNumber: i },
          {
            userIDOfHolder: data1.userIDOfHolder,
            score: data1.score,
            timeInMilliseconds: data1.timeInMilliseconds,
            scoreSubmissionDateAndTime: data1.scoreSubmissionDateAndTime,
            actionsPerformed: data1.actionsPerformed,
            enemiesKilled: data1.enemiesKilled,
            enemiesCreated: data1.enemiesCreated
          },
          function (error4, result4) {
            if (error4) {
              console.error(log.addMetadata(error4.stack, "error"));
            }
            return result4;
          }
        )
        .clone();
    }
  }
  // modify
  // this actually sets the new score
  for (var i = 50; i >= placePlayerRanked; i--) {
    if (i != 1) {
      let data1 = await leaderboardsModel
        .findOne({ rankNumber: i - 1 })
        .clone();
      await leaderboardsModel
        .findOneAndUpdate(
          { rankNumber: i },
          {
            userIDOfHolder: data1.userIDOfHolder,
            score: data1.score,
            timeInMilliseconds: data1.timeInMilliseconds,
            scoreSubmissionDateAndTime: data1.scoreSubmissionDateAndTime,
            actionsPerformed: data1.actionsPerformed,
            enemiesKilled: data1.enemiesKilled,
            enemiesCreated: data1.enemiesCreated
          },
          function (error4, result4) {
            if (error4) {
              console.error(log.addMetadata(error4.stack, "error"));
            }
            return result4;
          }
        )
        .clone();
    }
  }

  // this actually sets the new score
  await leaderboardsModel
    .findOneAndUpdate(
      { rankNumber: placePlayerRanked },
      {
        userIDOfHolder: userIDAsString,
        score: finalGameData.currentScore,
        timeInMilliseconds: finalGameData.currentInGameTimeInMilliseconds,
        scoreSubmissionDateAndTime: finalGameData.scoreSubmissionDateAndTime,
        actionsPerformed: finalGameData.actionsPerformed,
        enemiesKilled: finalGameData.enemiesKilled,
        enemiesCreated: finalGameData.enemiesCreated
      },
      function (error5, result5) {
        if (error5) {
          console.error(log.addMetadata(error5.stack, "error"));
        }
        return result5;
      }
    )
    .clone();
  return placePlayerRanked;
}

module.exports = {
  checkAndModifyLeaderboards
};
