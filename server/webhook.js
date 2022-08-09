const credentials = require("../credentials/credentials.js");
const utilities = require("./game/utilities.js");
const fetch = require("isomorphic-fetch");
const _ = require("lodash");

const global = require("./global.js");

function createAndSendWebhook(username, rank, finalGameData, gameMode) {
    let url = credentials.getDiscordWebhookURL();
    let arguments = {
        embeds: [
            {
                title: generateTitle(rank, gameMode),
                description: `${username} reached #${rank} on a${
                    gameMode == "easy" ? "n" : ""
                } ${_.startCase(
                    gameMode
                )} Singleplayer game with a score of ${finalGameData.currentScore} points, killing ${finalGameData.enemiesKilled} out of ${finalGameData.enemiesCreated} enemies and survived for ${utilities.turnMillisecondsToTime(finalGameData.currentInGameTimeInMilliseconds)} at ${(finalGameData.actionsPerformed/(finalGameData.currentInGameTimeInMilliseconds/60000)).toFixed(3)} actions per minute.`,
                color: generateColor(rank)
            }
        ]
    };
    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(arguments)
    });
}

function generateTitle(rank, gameMode) {
    if (rank == 1) {
        return `NEW ${gameMode.toUpperCase()} SINGLEPLAYER MODE WORLD RECORD!`;
    } else {
        return `A Top 50 score on the ${_.startCase(
            gameMode
        )} Singleplayer mode has been achieved!`;
    }
}

function generateColor(rank) {
    switch (rank) {
        case 1: {
            return 16766720;
        }
        case 2: {
            return 12632256;
        }
        case 3: {
            return 13467442;
        }
        default: {
            return 15658734;
        }
    }
}

module.exports = {
    createAndSendWebhook
};
