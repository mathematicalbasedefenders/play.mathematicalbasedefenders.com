const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema({
    reporter: String,
    reportedUser: String,
    reportDescription: String,
});

module.exports = mongoose.model(
    "ReportModel",
    ReportSchema,
    "reports"
);