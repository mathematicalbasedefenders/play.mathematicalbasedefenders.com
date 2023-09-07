import { log } from "./log";
import * as universal from "../universal";
import { findRoomWithConnectionID } from "./utilities";
import { Room } from "../game/Room";
//
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
function attemptToSendChatMessage(
  scope: string,
  message: string,
  socket: universal.GameSocket
) {
  const connectionID = socket.connectionID;
  if (!connectionID) {
    log.warn(`Socket has no ID.`);
    return;
  }
  switch (scope) {
    case "room": {
      if (!validateMessage(scope, message, connectionID)) {
        log.warn(
          `Message validation failed for Socket ID ${connectionID} (${universal.getNameFromConnectionID(
            connectionID
          )})`
        );
        return;
      }
      let room = findRoomWithConnectionID(connectionID, true) as Room;
      room.addChatMessage(
        message,
        universal.getNameFromConnectionID(connectionID) || ""
      );
      log.info(
        `Socket ID ${connectionID} (${universal.getNameFromConnectionID(
          connectionID
        )}) sent message ${DOMPurify.sanitize(message)} to Room ID ${room.id}`
      );
      break;
    }
    default: {
      log.warn(
        `Unknown chat message scope: ${scope} from Socket ID ${connectionID} (${universal.getNameFromConnectionID(
          connectionID
        )})`
      );
      break;
    }
  }
}

function validateMessage(scope: string, message: string, connectionID: string) {
  let roomID = findRoomWithConnectionID(connectionID, true)?.id;
  if (typeof roomID === "undefined") {
    log.warn(
      `No room found for Socket ID ${connectionID} (${universal.getNameFromConnectionID(
        connectionID
      )}) when attempting to send a chat message, therefore discarding message.`
    );
    return false;
  }
  let roomIndex = universal.rooms.findIndex((element) => element.id === roomID);
  if (roomIndex === -1) {
    log.warn(
      `Room doesn't exist for Socket ID ${connectionID} (${universal.getNameFromConnectionID(
        connectionID
      )}) when attempting to send a chat message, therefore discarding message.`
    );
    return false;
  }
  let notEmpty = message !== "";
  let notJustBlank = message.replace(/\s/g, "").length > 0;
  let notTooLong = message.length <= 256;
  let notDangerous = DOMPurify.sanitize(message) === message;
  if (!(notEmpty && notJustBlank && notTooLong && notDangerous)) {
    log.warn(
      `Socket ID ${connectionID} (${universal.getNameFromConnectionID(
        connectionID
      )}) sent an invalid message when attempting to send a chat message, therefore discarding message.`
    );
    return false;
  }
  return true;
}
export { attemptToSendChatMessage };
