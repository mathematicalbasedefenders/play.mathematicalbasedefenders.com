// anti xss
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// anti injection
const mongoDBSanitize = require("mongo-sanitize");

const User = require("./models/User.js");

const utilities = require("./game/utilities.js");
const global = require("./global.js");



async function fileReport(socket, reportedUser, reportDescription){
    
    let report = {}

    // sanitize
    report.reportDescription = mongoDBSanitize(DOMPurify.sanitize(reportDescription));

    // not logged in
    if (!socket.variables.loggedIn) {
        return;
    }

    // reporting too quickly
    if (Date.now() < await User.superSafeFindByUserID(socket.variables.userIDOfSocketHolder).moderation.timeLastReportFiled + 60 * 1000 * 5) {
        return;
    }

    report.reporter = socket.variables.userIDOfSocketHolder;
    report.reportedUser = utilities.getSocketAccordingToPlayerName(reportedUser);
    
    console.debug(report);

    return recordReport(report);

}

async function recordReport(report){
    try {
        await report.save();
        return true;
    } catch (error) {

        return false;
    }
}

module.exports = { fileReport }