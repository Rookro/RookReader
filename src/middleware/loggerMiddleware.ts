import { Middleware } from "@reduxjs/toolkit";
import { debug, trace } from "@tauri-apps/plugin-log";

/**
 * Determines if the given data is likely too large to be logged.
 *
 * @param data - The data to check.
 * @returns True if the data is likely too large to be logged, false otherwise.
 */
function isLikelyTooLargeStrinct(data: unknown): boolean {
  if (Array.isArray(data) && data.length > 10) {
    return true;
  }

  if (data && typeof data === "object") {
    const keys = Object.keys(data);
    if (keys.length > 10) {
      return true;
    }

    for (const key in keys) {
      if (!(key in data)) {
        continue;
      }

      const prop = (data as Record<string, unknown>)[key];
      if (prop && typeof prop === "object" && isLikelyTooLargeStrinct(prop)) {
        return true;
      }
    }
  }

  return false;
}

export const loggerMiddleware: Middleware = (store) => (next) => (action: unknown) => {
  if (typeof action === "object" && action !== null && "type" in action && "payload" in action) {
    if (isLikelyTooLargeStrinct(action.payload)) {
      debug(`Dispatching action. type:${action.type}}, payload: Large Object(Suppressed)`);
      trace(`Dispatching action. type:${action.type}}, payload:${JSON.stringify(action.payload)}`);
    } else {
      debug(`Dispatching action. type:${action.type}, payload:${JSON.stringify(action.payload)}`);
    }
  } else {
    debug(`Dispatching action. unknown type(${JSON.stringify(action)})`);
  }

  const result = next(action);
  trace(`[loggerMiddleware] next state: ${JSON.stringify(store.getState())}`);

  return result;
};
