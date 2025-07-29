/**
 * Logs a message to the console.
 * This logs the message with a prefix.
 * If prefix is not wanted, just call the respective
 * `console` method directly.
 */
const log = {
  error: (...message: Array<string>) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp} ERROR] ${message.join(" ")}`);
  },
  warn: (...message: Array<string>) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp} WARN] ${message.join(" ")}`);
  },
  info: (...message: Array<string>) => {
    const timestamp = new Date().toISOString();
    console.info(`[${timestamp} INFO] ${message.join(" ")}`);
  },
  debug: (...message: Array<string>) => {
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp} DEBUG] ${message.join(" ")}`);
  }
};

export { log };
