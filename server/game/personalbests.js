// models
var User = require("../models/User.js");
var EasyModeLeaderboardsRecord = require("../models/EasyModeLeaderboardsRecord.js");
var StandardModeLeaderboardsRecord = require("../models/StandardModeLeaderboardsRecord.js");
const global = require("../global.js");
const log = require("../core/log.js");
/**
 * Checks a player's personal best for a Singleplayer game.
 * @param {*} userIDAsString
 * @param {*} finalGameData
 * @param {*} gameMode
 * @param {*} usernameOfSocketOwner
 * @returns Whether the player's personal best is broken.
 */
async function checkSingleplayerPersonalBestForPlayer(
  userIDAsString,
  finalGameData,
  gameMode,
  usernameOfSocketOwner,
  playerDataOfSocketOwner
) {
  let personalBestBroken = false;
  let fieldToUpdate;
  let fullPathOfFieldToUpdate;

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

  if (
    Object.values(playerDataOfSocketOwner["statistics"][fieldToUpdate]).every(
      (property) => property === undefined || property == null
    )
  ) {
    User.setNewPersonalBestForUserID(userIDAsString, gameMode, finalGameData);
    personalBestBroken = true;
  } else {
    // personal best field exists
    if (
      finalGameData.currentScore >
      playerDataOfSocketOwner["statistics"][fieldToUpdate].score
    ) {
      User.setNewPersonalBestForUserID(userIDAsString, gameMode, finalGameData);
      personalBestBroken = true;
    }
  }
  return personalBestBroken;
}

module.exports = {
  checkSingleplayerPersonalBestForPlayer
};
