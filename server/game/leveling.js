const schemas = require("../core/schemas.js");
const log = require("../core/log.js");

function giveExperiencePointsToPlayer(username, amount) {}

async function giveExperiencePointsToPlayerID(userIDAsString, amount) {
    let toReturn = {
        leveledUp: false,
        currentLevel: 0
    };

    let oldData = await schemas
        .getUserModel()
        .findById(userIDAsString, (error2, result2) => {
            if (error2) {
                console.error(log.addMetadata(error2, "error"));
            }
            return result2;
        });

    let oldExperiencePointAmount = oldData.statistics.totalExperiencePoints;

    await schemas
        .getUserModel()
        .findByIdAndUpdate(
            userIDAsString,
            { $inc: { "statistics.totalExperiencePoints": amount } },
            { upsert: true },
            (error3, result3) => {
                if (error3) {
                    console.error(log.addMetadata(error3, "error"));
                }
                return result3;
            }
        );

    toReturn.currentLevel = getLevel(oldExperiencePointAmount + amount);

    if (
        oldExperiencePointAmount + amount > oldExperiencePointAmount &&
        getLevel(oldExperiencePointAmount + amount) >
            getLevel(oldExperiencePointAmount)
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

module.exports = { giveExperiencePointsToPlayerID, getLevel };
