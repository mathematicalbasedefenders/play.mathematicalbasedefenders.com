const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
    reporter: String,
    reportedUser: String,
    reportDescription: String,
    reportDateAndTime: Date,
});

module.exports = mongoose.model(
    "ReportModel",
    ReportSchema,
    "reports"
);