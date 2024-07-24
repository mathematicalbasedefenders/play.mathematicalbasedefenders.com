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
  const memoryUsage = process.memoryUsage();
  const usedHeapMemory = memoryUsage.heapUsed;
  const totalHeapMemory = memoryUsage.heapTotal;
  const totalOSMemory = os.totalmem();
  const usedOSMemory = totalOSMemory - os.freemem();
  log.debug(`GAME: ${usedHeapMemory} / ${totalHeapMemory}`);
  log.debug(`OS: ${usedOSMemory} / ${totalOSMemory}`);
}

export { updateSystemStatus };
