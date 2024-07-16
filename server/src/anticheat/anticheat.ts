import { ActionRecord } from "./typings/ActionRecord";
import { check } from "./check";

function performAnticheatCheck(data: Array<ActionRecord>) {
  const result = check(data);
  return result;
}

export { performAnticheatCheck };
