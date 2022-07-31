// bcrypt
const bcrypt = require("bcrypt");

// anti xss
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// anti injection
const mongoDBSanitize = require("mongo-sanitize");

const log = require("./core/log.js");
const utilities = require("./game/utilities.js");
const leveling = require("./game/leveling.js");


var User = require("./models/User.js");

let usersCurrentlyAttemptingToLogIn = [];

async function authenticate(socket, username, encodedPassword, sockets) {
    username = DOMPurify.sanitize(mongoDBSanitize(username));
    console.log(log.addMetadata("Log in attempt from " + username, "info"));

    if (!usersCurrentlyAttemptingToLogIn.includes(username)) {
        if (/^[a-zA-Z0-9_]*$/g.test(username)) {
            usersCurrentlyAttemptingToLogIn.push(username);
            socket.variables.playerDataOfSocketOwner = await User.findOne({
                username: username
            });

            if (socket.variables.playerDataOfSocketOwner) {
                let result = await checkPassword(
                    username,
                    encodedPassword,
                    socket
                );
                if (result) {
                    // successful login
                    let oldSocket = utilities.getSocketAccordingToUsername(
                        username,
                        global.sockets
                    );
                    if (oldSocket) {
                        oldSocket.send(JSON.stringify({
                            action:"showTextModal",arguments:{
                            text:"Your account has been accessed from another location. If this wasn't you, consider changing your password.",
                            title:"Forced Disconnection Notice"}
                    }));
                        oldSocket.close();
                    }
                    socket.variables.usernameOfSocketOwner =
                        socket.variables.playerDataOfSocketOwner.username;
                    socket.variables.userIDOfSocketOwner =
                        socket.variables.playerDataOfSocketOwner["_id"];
                    socket.send(JSON.stringify({action:"showTextModal",arguments:{title:"Successful Login!",text:`Successfully logged in as ${username}!`}}));
                    usersCurrentlyAttemptingToLogIn.splice(
                        usersCurrentlyAttemptingToLogIn.indexOf(username),
                        1
                    );
                    socket.variables.loggedIn = true;
                    socket.variables.playerRank = utilities.getPlayerRank(
                        socket.variables.playerDataOfSocketOwner
                    );
                    let playerLevel = leveling.getLevel(
                        socket.variables.playerDataOfSocketOwner.statistics
                            .totalExperiencePoints
                    );
                    socket.send(
                        JSON.stringify({action:"updateText",arguments:
                        {title:"#player-rank",
                        text:utilities.beautifyRankName(socket.variables.playerRank, username)}})
                    );
                    socket.send(
                        JSON.stringify({action:"updateCSS",arguments:{
                        selector:"#player-rank",
                        property:"color",
                        value:utilities.formatPlayerName(socket.variables.playerRank, username)}})
                    );
                    // TODO: What even is this?
                    // socket.send(
                    //     JSON.stringify({
                    //         action: "updateText",
                    //         arguments: { selector: username, text: $5 }
                    //     })
                    // );
                    "updateText",
                        "#secondary-top-bar-container",
                        `Level ${playerLevel}`;

                    console.log(
                        log.addMetadata(
                            `Correct password for ${username}!`,
                            "info"
                        )
                    );
                    return true;
                } else {
                    // failed log in
                    socket.send(JSON.stringify({action:"showTextModal",arguments:{title:"Failed log in!",text:`Failed to log in as ${username}`}}));
                    usersCurrentlyAttemptingToLogIn.splice(
                        usersCurrentlyAttemptingToLogIn.indexOf(username),
                        1
                    );
                    console.log(
                        log.addMetadata(
                            `Incorrect password for ${username}!`,
                            "info"
                        )
                    );
                    return false;
                }
            } else {
                console.log(
                    log.addMetadata("User " + username + " not found!", "info")
                );
                socket.send(JSON.stringify({action:"showTextModal",arguments:{title:"Failed log in!",text:`Failed to log in as ${username}`}}));
                usersCurrentlyAttemptingToLogIn.splice(
                    usersCurrentlyAttemptingToLogIn.indexOf(username),
                    1
                );
            }
            if (!socket){
            delete socket.variables.playerDataOfSocketOwner.emailAddress;
            delete socket.variables.playerDataOfSocketOwner.hashedPassword;
            }return false;
        } else {
            console.log(
                log.addMetadata("User " + username + " not found!", "info")
            );
            socket.send(JSON.stringify({action:"showTextModal",arguments:{title:"Failed log in!",text:`Failed to log in as ${username}`}}));
            usersCurrentlyAttemptingToLogIn.splice(
                usersCurrentlyAttemptingToLogIn.indexOf(username),
                1
            );
        }
        return false;
    } else {
        console.log(
            log.addMetadata(
                "User " + username + " is already trying to log in!",
                "info"
            )
        );
        socket.send(JSON.stringify({action:"showTextModal",arguments:{title:"Failed log in!",text:`Failed to log in as ${username}`}}));
                
    return false;}

}

async function checkPassword(username, encodedPassword, socket){
    decodedPassword = new Buffer.from(
        new Buffer.from(
            new Buffer.from(
                new Buffer.from(encodedPassword, "base64").toString(),
                "base64"
            ).toString(),
            "base64"
        ).toString(),
        "base64"
    ).toString();
    decodedPassword = DOMPurify.sanitize(mongoDBSanitize(decodedPassword));
    return await bcrypt.compare(
        decodedPassword,
        socket.variables.playerDataOfSocketOwner.hashedPassword
    );
}

module.exports = {
    authenticate
};
