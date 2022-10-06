const mongoose = require("mongoose");
const Report = require("./models/Report.js");
const User = require("./models/User.js");
const log = require("./core/log.js");
const utilities = require("./game/utilities.js");

const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

async function sendReport(reporter, reported, description) {
  let userIDOfReporter = reporter.variables?.userIDOfSocketOwner;
  let userIDOfReportedPlayer;
  let reportedPlayer = await User.safeFindByUsername(reported);

  if (reportedPlayer) {
    userIDOfReportedPlayer = reportedPlayer._id;
  } else {
    userIDOfReportedPlayer = "(Guest User)";
  }

  if (!(await validateReport(reporter)) || description.length > 500) {
    return false;
  }

  reportedPlayer = DOMPurify.sanitize(reported);
  description = DOMPurify.sanitize(description);

  // actually send the report

  let report = new Report({
    reporter: userIDOfReporter,
    reportedUser: userIDOfReportedPlayer,
    reportDescription: description,
    reportDateAndTime: Date.now()
  });

  // log time sent
  await report.save();
  await User.setLastReportTimeForUserID(userIDOfReporter);

  console.log(
    log.addMetadata(
      `Received a report from ${utilities.getNameOfSocketOwner(reporter)}`,
      "info"
    )
  );

  return true;
}

async function validateReport(reporter) {
  // return false if reporter is not logged in
  if (
    !reporter.variables?.userIDOfSocketOwner ||
    !reporter.variables.loggedIn
  ) {
    return false;
  }

  let reporterInformation = await User.safeFindByUserID(
    reporter.variables.userIDOfSocketOwner
  );

  // return false if reporter has already reported someone in the past 5 minutes
  if (
    new Date(reporterInformation.moderation.timeLastReportFiled).getTime() +
      5 * 60 * 1000 >
    Date.now()
  ) {
    return false;
  }

  return true;
}

module.exports = { sendReport };
