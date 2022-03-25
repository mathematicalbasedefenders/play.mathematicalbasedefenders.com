const sizeof = require("object-sizeof");

const configuration = require("./configuration.js");

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

module.exports = {
    generateRoomID,
    generateGuestName,
    getSizeInBytes,
    checkIfVariablesAreUndefined
};
