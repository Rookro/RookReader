import type { Middleware } from "@reduxjs/toolkit";
import { debug, trace } from "@tauri-apps/plugin-log";
import type { RootState } from "../store";

/**
 * Determines if the given data is likely too large to be logged.
 *
 * @param data - The data to check.
 * @returns True if the data is likely too large to be logged, false otherwise.
 */
function isLikelyTooLargeStrict(data: unknown): boolean {
  if (Array.isArray(data) && data.length > 10) {
    return true;
  }

  if (data && typeof data === "object") {
    const keys = Object.keys(data);
    if (keys.length > 10) {
      return true;
    }

    for (const key of keys) {
      if (!(key in data)) {
        continue;
      }

      const prop = (data as Record<string, unknown>)[key];
      if (prop && typeof prop === "object" && isLikelyTooLargeStrict(prop)) {
        return true;
      }
    }
  }

  return false;
}

export const loggerMiddleware: Middleware = (store) => (next) => (action: unknown) => {
  // Each log call is an IPC round trip, so skip the logging entirely below `debug`.
  const level = (store.getState() as RootState).settings.general.log.level;
  if (level !== "debug" && level !== "trace") {
    return next(action);
  }
  const traceOn = level === "trace";

  if (typeof action === "object" && action !== null && "type" in action && "payload" in action) {
    if (isLikelyTooLargeStrict(action.payload)) {
      debug(`Dispatching action. type:${action.type}, payload: Large Object(Suppressed)`);
      if (traceOn) {
        trace(`Dispatching action. type:${action.type}, payload:${JSON.stringify(action.payload)}`);
      }
    } else {
      debug(`Dispatching action. type:${action.type}, payload:${JSON.stringify(action.payload)}`);
    }
  } else {
    debug(`Dispatching action. unknown type(${JSON.stringify(action)})`);
  }

  const result = next(action);
  if (traceOn) {
    trace(`[loggerMiddleware] next state: ${JSON.stringify(store.getState())}`);
  }

  return result;
};
