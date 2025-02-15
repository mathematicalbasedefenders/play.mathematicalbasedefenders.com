const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
const mongoDBSanitize = require("express-mongo-sanitize");
import { log } from "../core/log";
import { User } from "../models/User";
import { authenticateForSocket } from "./authenticate";
import * as utilities from "../core/utilities";
import * as universal from "../universal";

async function authenticate(
  username: string,
  password: string,
  socketID: string
) {
  const htmlSanitizedUsername = DOMPurify.sanitize(username);
  const sanitizedUsername = mongoDBSanitize.sanitize(htmlSanitizedUsername);
  log.info(`Authentication request requested for account ${sanitizedUsername}`);

  /** Authenticate. */
  const result = await authenticateForSocket(username, password, socketID);
  const socket = universal.getSocketFromConnectionID(socketID);

  /** If can't find socket or socket connection ID is invalid. */
  if (!socket) {
    result.reason = `Invalid Socket Connection ID: ${socketID}`;
    log.warn(`Login attempt for ${username} failed: ${result.reason}`);
    return false;
  }

  /** If failed to log in for other reason. */
  if (!result.good) {
    log.warn(`Login attempt for ${username} failed: ${result.reason}`);
    const MESSAGE = `Failed to login as ${username} (${result.reason})`;
    const BORDER_COLOR = "#ff0000";
    universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);
    return false;
  }

  /** Successfully logged in. */
  socket.loggedIn = true;
  socket.ownerUsername = sanitizedUsername as string;
  socket.ownerUserID = result.id as string;
  const userData = await User.safeFindByUsername(socket.ownerUsername);
  utilities.updateSocketUserInformation(socket);
  socket.playerRank = utilities.getRank(userData);
  const MESSAGE = `Successfully logged in as ${username}`;
  const BORDER_COLOR = "#1fa628";
  universal.sendToastMessageToSocket(socket, MESSAGE, BORDER_COLOR);

  /** Exit opening screen */
  socket.send(JSON.stringify({ message: "exitOpeningScreen" }));

  /** Send data. */
  const statistics = userData.statistics;
  socket.send(
    JSON.stringify({
      message: "updateUserInformationText",
      data: {
        username: username,
        good: true,
        userData: userData,
        rank: utilities.getRank(userData),
        experiencePoints: statistics.totalExperiencePoints,
        records: {
          easy: statistics.personalBestScoreOnEasySingleplayerMode,
          standard: statistics.personalBestScoreOnStandardSingleplayerMode
        },
        reason: "All checks passed."
      }
    })
  );

  // Also add missing keys
  if (socket.ownerUserID) {
    User.addMissingKeys(socket.ownerUserID);
  }
  return true;
}

export { authenticate };
