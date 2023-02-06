import { connection } from "mongoose";
import * as universal from "../universal";
import { log } from "./log";
import { Room } from "../game/Room";

function checkIfPropertyWithValueExists(
  dataset: unknown,
  targetProperty: string,
  targetValue: string
) {
  if (Array.isArray(dataset)) {
    for (let i = 0; i < dataset.length; i++) {
      if (dataset[i][targetProperty] === targetValue) {
        return true;
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

export {
  checkIfPropertyWithValueExists,
  findRoomWithConnectionID,
  findGameDataWithConnectionID
};
