const sizeof = require("object-sizeof");

const configuration = require("../configuration.js");

const roomTypes = {
    SINGLEPLAYER: "singleplayer",
    DEFAULT_MULTIPLAYER: "defaultMultiplayerMode",
    MULTIPLAYER: "multiplayer"
};

const modes = {
    SINGLEPLAYER: "singleplayer",
    DEFAULT_MULTIPLAYER: "defaultMultiplayerMode",
    MULTIPLAYER: "multiplayer"
};

const playerRanks = {
    GAME_MASTER: "gameMaster",
    DEVELOPER: "developer",
    ADMINISTRATOR: "administrator",
    MODERATOR: "moderator",
    CONTRIBUTOR: "contributor",
    TESTER: "tester",
    DONATOR: "donator"
};

const TERMS = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "+",
    "-",
    "*",
    "/",
    "=",
    "a",
    "b",
    "c",
    "d",
    "n",
    "x",
    "y",
    "z"
];
const TERMS_AS_BEAUTIFUL_STRINGS = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "+",
    "\u2013",
    "×",
    "÷",
    "=",
    "a",
    "b",
    "c",
    "d",
    "n",
    "x",
    "y",
    "z"
];

function generateRoomID() {
    characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    roomID = undefined;
    while (roomID === undefined) {
        generatedRoomID = "";
        for (i = 0; i < 8; i++) {
            generatedRoomID += characters.charAt(
                Math.floor(Math.random() * characters.length)
            );
        }
        roomID = generatedRoomID;
    }
    return roomID;
}

function generateGuestName() {
    characters = "0123456789";
    generatedName = "";
    for (i = 0; i < 8; i++) {
        generatedName += characters
            .charAt(Math.floor(Math.random() * characters.length))
            .toString();
    }
    return "Guest " + generatedName.toString();
}

function getSizeInBytes(string) {
    if (configuration.developerConfiguration.settings.logAmountOfDataSent) {
        return sizeof(string);
    }
    return 0;
}

function checkIfVariablesAreUndefined(...inputs) {
    for (let i = 0; i < inputs.length; i++) {
        if (inputs[i] === undefined || inputs[i] === null) {
            return true;
        }
    }
    return false;
}

function getSocketAccordingToUsername(username, sockets) {
    return sockets.find((socket) => {
        return socket.variables.usernameOfSocketOwner == username;
    });
}

function getSocketAccordingToPlayerName(name, sockets) {
    if (/Guest(-|\s)[0-9]{8}/.test(name)) {
        return sockets.find((socket) => {
            return socket.variables.guestNameOfSocketOwner == name.replace(" ", "-");
        });
    }
        return sockets.find((socket) => {
            return socket.variables.usernameOfSocketOwner == name;
        });
}

function turnMillisecondsToTime(milliseconds) {
    let h = Math.floor(milliseconds / (60 * 60 * 1000));
    let dm = milliseconds % (60 * 60 * 1000);
    let m = Math.floor(dm / (60 * 1000));
    let ds = dm % (60 * 1000);
    let s = Math.floor(ds / 1000);

    let hh = h < 10 ? "0" + h : h;
    let mm = m < 10 ? "0" + m : m;
    let ss = s < 10 ? "0" + s : s;
    let ms = String(Math.floor(ds % 1000)).padStart(3, "0");

    if (h >= 1) {
        return hh + ":" + mm + ":" + ss + "." + ms;
    } else {
        return mm + ":" + ss + "." + ms;
    }
}

function calculateProblemLengthMultiplier(problemLength) {
    if (problemLength < 7) {
        return 1;
    } else if (problemLength < 14) {
        return 1 + 0.1 * (problemLength - 6);
    } else {
        return 1 + 0.2 * (problemLength - 9);
    }
}

function calculateEnemyPositionMultiplier(sPosition) {
    return sPosition < 5 ? 1 : 1 + 0.1 * Math.floor(sPosition - 5);
}

function calculateComboMultiplier(combo) {
    return 1 + 0.1 * Math.max(combo, 0);
}

function convertTermIDToTerm(id) {
    return TERMS[id];
}

function convertTermIDToBeautifulString(id) {
    return TERMS_AS_BEAUTIFUL_STRINGS[id];
}

function getPlayerRank(playerDataOfSocketOwner) {
    if (playerDataOfSocketOwner.username == "mistertfy64") {
        return playerRanks.GAME_MASTER;
    } else if (playerDataOfSocketOwner.membership.isDeveloper) {
        return playerRanks.DEVELOPER;
    } else if (playerDataOfSocketOwner.membership.isAdministrator) {
        return playerRanks.ADMINISTRATOR;
    } else if (playerDataOfSocketOwner.membership.isModerator) {
        return playerRanks.MODERATOR;
    } else if (playerDataOfSocketOwner.membership.isContributor) {
        return playerRanks.CONTRIBUTOR;
    } else if (playerDataOfSocketOwner.membership.isTester) {
        return playerRanks.TESTER;
    } else if (playerDataOfSocketOwner.membership.isDonator) {
        return playerRanks.DONATOR;
    }
}

function formatPlayerName(rank, username) {
    if (username === undefined || username == null) {
        return "#000000";
    }
    if (username == "mistertfy64") {
        return "#ff0000";
    } else if (rank == playerRanks.DEVELOPER) {
        return "#ff0000";
    } else if (rank == playerRanks.ADMINISTRATOR) {
        return "#ff0000";
    } else if (rank == playerRanks.MODERATOR) {
        return "#ff7f00";
    } else if (rank == playerRanks.CONTRIBUTOR) {
        return "#4070ff";
    } else if (rank == playerRanks.TESTER) {
        return "#0194ff";
    } else if (rank == playerRanks.DONATOR) {
        return "#1dc444";
    }
    return "#000000";
}

function beautifyRankName(rank, username) {
    if (username === undefined || username == null) {
        return "";
    }
    if (username == "mistertfy64") {
        return "Game Master";
    } else if (rank == playerRanks.DEVELOPER) {
        return "Developer";
    } else if (rank == playerRanks.ADMINISTRATOR) {
        return "Administrator";
    } else if (rank == playerRanks.MODERATOR) {
        return "Moderator";
    } else if (rank == playerRanks.CONTRIBUTOR) {
        return "Contributor";
    } else if (rank == playerRanks.TESTER) {
        return "Tester";
    } else if (rank == playerRanks.DONATOR) {
        return "Donator";
    }
    return "";
}

function calculateMessageForGlobalRank(rank) {
    if (rank == 1) {
        return "New World Record!";
    } else if (rank >= 2 && rank <= 50) {
        return "Global Rank #" + rank;
    } else {
        return "";
    }
}

function getNameOfSocketOwner(socket) {
    if (socket.variables.loggedIn) {
        return socket.connectionID;
    } else {
        return socket.connectionID.replace("-", " ");
    }
}

module.exports = {
    generateRoomID,
    generateGuestName,
    getSizeInBytes,
    checkIfVariablesAreUndefined,
    getSocketAccordingToUsername,
    turnMillisecondsToTime,
    calculateEnemyPositionMultiplier,
    calculateProblemLengthMultiplier,
    calculateComboMultiplier,
    convertTermIDToTerm,
    convertTermIDToBeautifulString,
    getPlayerRank,
    beautifyRankName,
    formatPlayerName,
    calculateMessageForGlobalRank,
    getNameOfSocketOwner,
    getSocketAccordingToPlayerName,
};
