import os from "os";
import { STATUS } from "../universal";

const SYSTEM_STATUS_UPDATE_INTERVAL = 5000;
let systemStatusUpdateTime = 0;

const result = {
  os: {
    level: 0,
    usage: 0
  },
  updateTime: {
    level: 0,
    time: 0
  }
};

function updateSystemStatus(deltaTime: number) {
  systemStatusUpdateTime += deltaTime;
  if (systemStatusUpdateTime < SYSTEM_STATUS_UPDATE_INTERVAL) {
    return result;
  }
  systemStatusUpdateTime -= SYSTEM_STATUS_UPDATE_INTERVAL;
  checkStatus();
  return result;
}

function checkStatus() {
  // get memory usages
  const memoryUsage = process.memoryUsage();
  const totalOSMemory = os.totalmem();
  const usedOSMemory = totalOSMemory - os.freemem();
  // send status updates
  // for os memory
  result.os.usage = usedOSMemory / totalOSMemory;
  result.os.level = getOSMemoryLevel(result.os.usage);
  // for update time
  result.updateTime.time = STATUS.lastDeltaTimeToUpdate;
  result.updateTime.level = getUpdateTimeLevel();
  return result;
}

function getOSMemoryLevel(usage: number) {
  if (usage >= 0.95) {
    return 2;
  }
  if (usage >= 0.85) {
    return 1;
  }
  return 0;
}

function getUpdateTimeLevel() {
  if (STATUS.lastDeltaTimeToUpdate >= 100) {
    return 2;
  }
  if (STATUS.lastDeltaTimeToUpdate >= 40) {
    return 1;
  }
  return 0;
}

export { updateSystemStatus };
