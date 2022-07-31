// anti xss
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// anti injection
const mongoDBSanitize = require("mongo-sanitize");

const User = require("./models/User.js");




async function fileReport(socket, reportedUser, reportDescription){
    
    let report = {}

    // sanitize
    report.reportDescription = mongoDBSanitize(DOMPurify.sanitize(report.reportDescription));

    // not logged in
    if (!socket.variables.loggedIn) {
        return;
    }

    // reporting too quickly
    if (Date.now() < await User.superSafeFindByUserID(socket.variables.userIDOfSocketHolder).moderation.timeLastReportFiled + 60 * 1000 * 5) {
        return;
    }

    report.reporter = socket.variables.userIDOfSocketHolder;
    report.reportedUser = getSocketAccordingToPlayerName(reportedUser, );
    
    
    recordReport(report);

}

async function recordReport(report, socket, reportedUser){
    
}

module.exports = { fileReport }