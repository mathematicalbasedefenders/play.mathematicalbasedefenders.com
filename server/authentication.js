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

async function checkPassword(username, encodedPassword, socket) {
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
        socket.playerDataOfSocketOwner.hashedPassword
    );
}

module.exports = {
    checkPassword
};
