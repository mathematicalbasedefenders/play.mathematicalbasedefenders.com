const credentials = require("../credentials/credentials.js");
const fetch = require("isomorphic-fetch");
const _ = require("lodash");

function createAndSendWebhook(username, rank, score, gameMode) {
	let url = credentials.getDiscordWebhookURL();
	let parameters = {
		embeds: [
			{
				title: generateTitle(rank, gameMode),
				description: `${username} reached #${rank} on a${gameMode == "easy" ? "n" : ""} ${_.startCase(gameMode)} Singleplayer game with a score of ${score} points.`,
                color: generateColor(rank),
            },
		],
	};
	fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(parameters),
	});
}

function generateTitle(rank, gameMode) {
	if (rank == 1) {
		return `NEW ${gameMode.toUpperCase()} SINGLEPLAYER MODE WORLD RECORD!`;
	} else {
		return `A Top 50 score on the ${_.startCase(gameMode)} Singleplayer mode has been achieved!`;
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
	createAndSendWebhook,
};
