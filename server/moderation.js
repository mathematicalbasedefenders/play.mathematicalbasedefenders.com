const mongoose = require("mongoose");
const Report = require("./models/Report.js");
const User = require("./models/User.js");


async function sendReport(reporter, reported, description){
    
    let userIDOfReporter = reporter.variables?.userIDOfSocketOwner;
    
    if (!userIDOfReporter){
        console.debug("Report not saved (reporter is a guest)");
        return;
    }

    let userIDOfReportedPlayer;
    let reportedPlayer = await User.safeFindByUsername(reported);
    
    if (reportedPlayer){
        userIDOfReportedPlayer = reportedPlayer._id;
    } else {

        userIDOfReportedPlayer = "(Guest User)"
    }
    
    let report = new Report({
        reporter: userIDOfReporter,
        reportedUser: reported,
        reportDescription: description,
        reportDateAndTime: Date.now(),    
    })
    await report.save();
}

module.exports = {sendReport}
