const mongoose = require("mongoose");
const Schema = mongoose.Schema;



const UserModelSchema = new Schema({
	username: String,
	usernameInAllLowercase: String,
	email: String,
	hashedPassword: String,
	userNumber: Number,
	statistics: {
		personalBestScore: Number,
		gamesPlayed: Number,
	},
});

const UserModel = mongoose.model("UserModel", UserModelSchema, "users");

const LeaderboardsSchema = new Schema({
	rankNumber: Number,
	userIDOfHolder: String,
	score: Number,
});

const LeaderboardsModel = mongoose.model("LeaderboardsModel", LeaderboardsSchema, "leaderboards");

function getUserModel(){
    return UserModel;
}

function getLeaderboardsModel(){
    return LeaderboardsModel;
}

module.exports = {
    getUserModel,
    getLeaderboardsModel,
}