import { User } from "../models/User";
import { log } from "../core/log";
import * as universal from "../universal";
const bcrypt = require("bcrypt");
const mongoDBSanitize = require("express-mongo-sanitize");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
// TODO: Consider moving this to services folder
async function authenticateForSocket(
  username: unknown | undefined,
  password: unknown | undefined,
  socketID: unknown | undefined,
  bypassDatabase?: boolean
) {
  // check if database is available, or if it is bypassed
  if (!bypassDatabase && !universal.STATUS.databaseAvailable) {
    log.warn("Database is not available. Ignoring log-in request.");
    return {
      good: false,
      reason:
        "Database is not available. This is usually on the server-side. Please contact the server's administrator if this persists."
    };
  }
  // check socket conditions
  const canBeAuthenticated = checkIfSocketCanBeAuthenticated(
    socketID as string
  );
  if (!canBeAuthenticated.good) {
    log.info(`A socket failed validation checks  ${canBeAuthenticated.reason}`);
    return canBeAuthenticated;
  }

  // validate data
  let dataValidationResult = validateData(username, password, socketID);
  if (!(dataValidationResult.good === true)) {
    log.info(
      `A user didn't pass data validation checks and therefore can't be logged in. (${dataValidationResult.reason})`
    );
    return {
      good: false,
      reason: dataValidationResult.reason
    };
  }
  // actually compare passwords
  let userDocument = await User.findByUsername(username as string);
  if (!userDocument) {
    log.info(
      `User ${username} doesn't exist and therefore can't be logged in. (Socket ID: ${socketID})`
    );
    return {
      good: false,
      reason: "User not found."
    };
  }
  let passwordResult = await bcrypt.compare(
    password,
    userDocument.hashedPassword
  );
  if (!passwordResult) {
    log.info(
      `User ${username} has unsuccessfully logged in due to an incorrect password. (Socket ID: ${socketID})`
    );
    return {
      good: false,
      reason: "Incorrect password."
    };
  }
  let id = userDocument._id.toString();
  log.info(
    `User ${username} has successfully logged in. (Socket ID: ${socketID})`
  );
  // log out sockets that were already logged in
  let duplicateSockets = universal.getSocketsFromUserID(id);
  for (let duplicateSocket of duplicateSockets || []) {
    duplicateSocket.send(
      JSON.stringify({
        message: "createToastNotification",
        // TODO: Refactor this
        text: `Disconnected due to your account being logged in from another location. If this wasn't you, consider changing your password.`,
        options: { borderColor: "#4f0909" }
      })
    );
    universal.deleteSocket(duplicateSocket);
    log.warn(
      `Disconnected socket ${duplicateSocket.connectionID} because a new socket logged in with the same credentials. (${username})`
    );
  }
  return {
    good: true,
    reason: "All checks passed",
    id: id
  };
}

function validateData(
  username: unknown | undefined,
  password: unknown | undefined,
  socketID: unknown | undefined
) {
  // socket is already logged in
  if (universal.getSocketFromConnectionID(socketID as string)?.loggedIn) {
    return {
      good: false,
      reason: "User is already logged in."
    };
  }
  if (typeof username !== "string" || username === "") {
    return {
      good: false,
      reason: "Username field is empty."
    };
  }
  if (typeof password !== "string" || password === "") {
    return {
      good: false,
      reason: "Password field is empty."
    };
  }
  if (typeof socketID !== "string" || password === "") {
    return {
      good: false,
      reason: "Invalid Socket ID."
    };
  }
  // validate data
  let sanitizedUsername = mongoDBSanitize.sanitize(
    DOMPurify.sanitize(username)
  );
  let sanitizedPassword = mongoDBSanitize.sanitize(
    DOMPurify.sanitize(password)
  );
  if (
    sanitizedUsername !== username ||
    sanitizedUsername.length > 20 ||
    sanitizedUsername.length < 3
  ) {
    return {
      good: false,
      reason: "Username is invalid."
    };
  }
  if (
    sanitizedPassword !== password ||
    sanitizedPassword.length > 48 ||
    sanitizedPassword.length < 8
  ) {
    return {
      good: false,
      reason: "Password is invalid or contains illegal characters."
    };
  }
  return {
    good: true,
    reason: "All checks passed."
  };
}

/**
 * Checks whether a browser/socket is "eligible" to log in.
 * i.e., Browser session validation.
 * @param {string} connectionID The `connectionID` of the socket.
 * @returns An object with the fields `good` and `reason`. `good` is `true` if socket is eligible to log in, false otherwise with a reason in `reason`.
 */
function checkIfSocketCanBeAuthenticated(connectionID: string) {
  const socket = universal.getSocketFromConnectionID(connectionID as string);

  // socket doesn't exist
  if (!socket) {
    log.warn(
      `A user tried to log in, but the session that sent the credentials isn't tied to a socket.`
    );
    return {
      good: false,
      reason: "Browser session isn't tied to a socket."
    };
  }

  // socket already exited opening screen.
  if (socket.exitedOpeningScreen) {
    log.warn(
      `A user tried to log in, but the socket tied to that session already exited opening screen.`
    );
    return {
      good: false,
      reason: "Socket already exited opening screen."
    };
  }

  // socket doesn't have a connection id
  if (!socket.connectionID) {
    log.warn(
      `A user tried to log in, but the socket tied to that session doesn't have an identifier.`
    );
    return {
      good: false,
      reason: "Socket doesn't have an identifier."
    };
  }

  // socket's id is in an incorrect format.
  if (socket.connectionID.length !== 16) {
    log.warn(`A user tried to log in, but the socket's identifier is invalid.`);
    return {
      good: false,
      reason: "Socket's identifier is invalid."
    };
  }

  // socket is current playing
  const playing = universal.checkIfSocketIsPlaying(socket.connectionID);
  if (playing) {
    log.info(
      `A user tried to log in, but the socket tied to that session is currently in game.`
    );
    return {
      good: false,
      reason:
        "Socket is currently in game. Finish the game first before logging in."
    };
  }

  return {
    good: true,
    reason: "All socket authentication eligibility checks passed."
  };
}

export { authenticateForSocket };
