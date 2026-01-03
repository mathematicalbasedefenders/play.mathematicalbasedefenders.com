const mongoDBSanitize = require("express-mongo-sanitize");
import { log } from "../core/log";
import { User, UserInterface } from "../models/User";
import { authenticateForSocket } from "./authenticate";
import * as utilities from "../core/utilities";
import * as universal from "../universal";
import { DOMPurifySanitizer } from "../sanitizer";
import { UserData } from "../universal";

const FAILED_BORDER_COLOR = "#ff0000";
const SUCCESS_BORDER_COLOR = "#00dd00";

async function authenticate(
  username: string,
  password: string,
  socketID: string
) {
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
    universal.sendToastMessageToSocket(socket, MESSAGE, FAILED_BORDER_COLOR);
    return false;
  }

  /** Successfully logged in. */
  socket.getUserData().loggedIn = true;
  socket.getUserData().ownerUsername = username;
  socket.getUserData().ownerUserID = result.id as string;
  const userData = await User.safeFindByUsername(username);
  utilities.updateSocketUserInformation(socket);
  socket.getUserData().playerRank = utilities.getRank(userData);

  /** Send toast message that logged in. */
  const MESSAGE = `Successfully logged in as ${username}`;
  universal.sendToastMessageToSocket(socket, MESSAGE, SUCCESS_BORDER_COLOR);

  /** Exit opening screen */
  const exitOpeningScreen = JSON.stringify({ message: "exitOpeningScreen" });
  socket.send(exitOpeningScreen);

  /** Send data. */
  sendUserStatistics(socket, userData);

  // Also add missing keys
  if (typeof result.id === "string") {
    User.addMissingKeys(result.id);
  }
  return true;
}

function sendUserStatistics(
  socket: universal.GameWebSocket<UserData>,
  userData: UserInterface
) {
  const username = userData.username;
  const statistics = userData.statistics;
  socket.send(
    JSON.stringify({
      message: "updateUserInformationText",
      data: {
        username: username,
        good: true,
        userData: userData,
        rank: socket.getUserData().playerRank,
        experiencePoints: statistics.totalExperiencePoints,
        records: {
          easy: statistics.personalBestScoreOnEasySingleplayerMode,
          standard: statistics.personalBestScoreOnStandardSingleplayerMode
        },
        reason: "All checks passed."
      }
    })
  );
}

export { authenticate };
