import type { Logger } from '../types/internal';

export function createLogger(verbose = false): Logger {
  return {
    info(message) {
      console.log(message);
    },
    warn(message) {
      console.warn(`Warning: ${message}`);
    },
    error(message) {
      console.error(`Error: ${message}`);
    },
    debug(message) {
      if (verbose) {
        console.log(`[debug] ${message}`);
      }
    }
  };
}
