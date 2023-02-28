import { connection } from "mongoose";
import * as universal from "../universal";
import { log } from "./log";
import { Room } from "../game/Room";
import { User, UserInterface } from "../models/User";
// Highest comes first
const RANK_ORDER = [
  ["Developer", "isDeveloper"],
  ["Administrator", "isAdministrator"],
  ["Moderator", "isModerator"],
  ["Contributor", "isContributor"],
  ["Tester", "isTester"],
  ["Donator", "isDonator"]
];

function checkIfPropertyWithValueExists(
  dataset: unknown,
  targetProperty: string,
  targetValue: string
) {
  if (Array.isArray(dataset)) {
    for (let i = 0; i < dataset.length; i++) {
      try {
        if (dataset[i][targetProperty] === targetValue) {
          return true;
        }
        // TODO: this is temporary failsafe
      } catch (error: any) {
        log.error(error.stack);
        return false;
      }
    }
  }
  return false;
}

function findGameDataWithConnectionID(connectionID: string, room?: Room) {
  // if room is defined, function jumps to finding game data from that room.
  if (!room) {
    log.warn(
      "Finding game data for a connection ID with an unknown room is not supported yet."
    );
    return null;
  }
  for (let gameData of room.gameData) {
    if (gameData.owner === connectionID) {
      return gameData;
    }
  }
  return null;
}

function findRoomWithConnectionID(
  connectionID: string,
  countSpectatorsToo?: boolean
) {
  for (let room in universal.rooms) {
    if (countSpectatorsToo) {
      if (
        universal.rooms[room].memberConnectionIDs.indexOf(connectionID) > -1 ||
        universal.rooms[room].spectatorConnectionIDs.indexOf(connectionID) > -1
      ) {
        return universal.rooms[room];
      }
    } else {
      if (
        universal.rooms[room].memberConnectionIDs.indexOf(connectionID) > -1
      ) {
        return universal.rooms[room];
      }
    }
  }
  return null;
}
function millisecondsToTime(milliseconds: number) {
  let m = Math.floor(milliseconds / 60000);
  let s = Math.floor((milliseconds % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  let ms = Math.floor((milliseconds % 60000) % 1000)
    .toString()
    .padStart(3, "0");
  return `${m}:${s}.${ms}`;
}

function getRank(data: UserInterface | string) {
  if (typeof data === "string") {
    // ...
    return "";
  } else {
    // TODO: Refactor this stupid thing already
    if (data.membership.isDeveloper) {
      return { title: "Developer", color: "#ff0000" };
    }
    if (data.membership.isAdministrator) {
      return { title: "Administrator", color: "#da1717" };
    }
    if (data.membership.isModerator) {
      return { title: "Moderator", color: "#ff7f00" };
    }
    if (data.membership.isContributor) {
      return { title: "Contributor", color: "#01acff" };
    }
    if (data.membership.isTester) {
      return { title: "Tester", color: "#5bb1e0" };
    }
    if (data.membership.isDonator) {
      return { title: "Donator", color: "#26e02c" };
    }
    // No rank
    return { title: "", color: "#ffffff" };
  }
}

export {
  checkIfPropertyWithValueExists,
  findRoomWithConnectionID,
  findGameDataWithConnectionID,
  millisecondsToTime,
  getRank
};
