import * as utilities from "./utilities";
import * as universal from "../universal";
class Room {
  id: string;
  hostConnectionID: string;
  memberConnectionIDs: Array<string> = [];
  spectatorConnectionIDs: Array<string> = [];
  constructor(hostConnectionID: string) {
    this.id = generateRoomID(8);
    this.hostConnectionID = hostConnectionID;
    this.memberConnectionIDs.push(hostConnectionID);
  }
}

function generateRoomID(length: number): string {
  let pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let current = "";
  while (
    current === "" ||
    utilities.checkIfPropertyWithValueExists(
      universal.rooms,
      "connectionID",
      current
    )
  ) {
    for (let i = 0; i < length; i++) {
      current += pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return current;
}

export { Room };
