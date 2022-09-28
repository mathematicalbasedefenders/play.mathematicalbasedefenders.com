// anti xss
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// anti injection
const mongoDBSanitize = require("mongo-sanitize");

const User = require("./models/User.js");
const Report = require("./models/Report.js");


const utilities = require("./game/utilities.js");
const global = require("./global.js");

const log = require("./core/log.js");

async function fileReport(socket, reportedUser, reportDescription) {
  let report = {};

  // sanitize
  report.reportDescription = mongoDBSanitize(
    DOMPurify.sanitize(reportDescription)
  );

  // not logged in
  if (!socket.variables.loggedIn) {
    return false;
  }

  let reporter = User.superSafeFindByUserID(
    socket.variables.userIDOfSocketOwner
  );

  // reporting too quickly
  if (
    reporter?.moderation?.timeLastReportFiled != null &&
    Date.now() < reporter.moderation.timeLastReportFiled + 60 * 1000 * 5
  ) {
    return false;
  }

  report.reporter = socket.variables.userIDOfSocketOwner;
  report.reportedUser = utilities.getSocketAccordingToPlayerName(reportedUser);

  return await recordReport(report);
}

async function recordReport(reportContents) {
  let report = new Report(reportContents);
  try {
    await report.save();
    return true;
  } catch (error) {
    console.error(log.addMetadata(`Error saving report: ${error.stack}`,"error"))
    return false;
  }
}

module.exports = { fileReport };
