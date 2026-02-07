import { Middleware } from "@reduxjs/toolkit";
import { debug, trace } from "@tauri-apps/plugin-log";

export const loggerMiddleware: Middleware = (store) => (next) => (action: unknown) => {
  if (typeof action === "object" && action !== null && "type" in action && "payload" in action) {
    if (Array.isArray(action.payload)) {
      debug(`[loggerMiddleware] Dispatching action. type:${action.type}}`);
      trace(
        `[loggerMiddleware] Dispatching action. type:${action.type}}, payload:${JSON.stringify(action.payload)}`,
      );
    } else {
      debug(
        `[loggerMiddleware] Dispatching action. type:${action.type}, payload:${JSON.stringify(action.payload)}`,
      );
    }
  } else {
    debug(`[loggerMiddleware] Dispatching action. unknown type(${JSON.stringify(action)})`);
  }

  const result = next(action);
  trace(`[loggerMiddleware] next state: ${JSON.stringify(store.getState())}`);

  return result;
};
