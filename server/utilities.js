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

function getSocketAccordingToUsername(username, sockets){
    return sockets.filter((socket) => {
        return socket.usernameOfSocketOwner == username;
    })[0];
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


module.exports = {
    generateRoomID,
    generateGuestName,
    getSizeInBytes,
    checkIfVariablesAreUndefined,
    getSocketAccordingToUsername,
    turnMillisecondsToTime,
};
