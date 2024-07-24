import os from "os";
import { log } from "./log";

const SYSTEM_STATUS_UPDATE_INTERVAL = 5000;
let systemStatusUpdateTime = 0;

function updateSystemStatus(deltaTime: number) {
  systemStatusUpdateTime += deltaTime;
  if (systemStatusUpdateTime < SYSTEM_STATUS_UPDATE_INTERVAL) {
    return;
  }
  checkStatus();
  systemStatusUpdateTime -= SYSTEM_STATUS_UPDATE_INTERVAL;
}

function checkStatus() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  log.debug(`${freeMemory} / ${totalMemory}`);
}

export { updateSystemStatus };
