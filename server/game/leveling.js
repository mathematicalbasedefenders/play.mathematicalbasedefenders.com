const log = require("../core/log.js");
const global = require("../global.js");

// models
var User = require("../models/User.js");
var EasyModeLeaderboardsRecord = require("../models/EasyModeLeaderboardsRecord.js");
var StandardModeLeaderboardsRecord = require("../models/StandardModeLeaderboardsRecord.js");

async function giveExperiencePointsToUserID(userIDAsString, amount) {
  let toReturn = {
    leveledUp: false,
    currentLevel: 0
  };

  let userInstance = await User.safeFindByUserID(userIDAsString);
  let oldExperiencePoints = userInstance.statistics.totalExperiencePoints;

  await User.giveExperiencePointsToUserID(userIDAsString, amount);

  let newExperiencePoints = oldExperiencePoints + amount;

  toReturn.currentLevel = getLevel(newExperiencePoints);

  if (
    newExperiencePoints > oldExperiencePoints &&
    getLevel(newExperiencePoints) > getLevel(oldExperiencePoints)
  ) {
    toReturn.leveledUp = true;
  }

  return toReturn;
}

function getLevel(experiencePoints) {
  let currentLevel = 0;
  while (500 * Math.pow(currentLevel + 1, 0.75) <= experiencePoints) {
    experiencePoints -= 500 * Math.pow(currentLevel + 1, 0.75);
    currentLevel++;
  }
  return currentLevel;
}

module.exports = { giveExperiencePointsToUserID, getLevel };
