/**
 * Logs a message to the console.
 * This logs the message with a prefix.
 * If prefix is not wanted, just call the respective
 * `console` method directly.
 */
const log: {
  error: Function;
  warn: Function;
  info: Function;
  debug: Function;
} = {
  error: (message: string) => {
    console.error(`${"[" + new Date().toISOString() + " ERROR]"} ${message}`);
  },
  warn: (message: string) => {
    console.warn(`${"[" + new Date().toISOString() + " WARN]"} ${message}`);
  },
  info: (message: string) => {
    console.info(`${"[" + new Date().toISOString() + " INFO]"} ${message}`);
  },
  debug: (message: string) => {
    console.debug(`${"[" + new Date().toISOString() + " DEBUG]"} ${message}`);
  }
};

export { log };
