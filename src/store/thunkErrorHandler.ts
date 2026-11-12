import { error } from "@tauri-apps/plugin-log";
import { CommandError, ErrorCode } from "../types/Error";
import type { ThunkRejectValue } from "./createCommandThunk";

/**
 * Handles errors caught in async thunks by logging the error and returning
 * a properly formatted rejection value.
 *
 * @param e - The caught error.
 * @param context - A descriptive string for the error context (used in log messages).
 * @param rejectWithValue - The RTK `rejectWithValue` function from the thunk API.
 * @param superseded - Whether a newer request replaced the failed one; marks the value
 * `superseded` so that the failure is not shown.
 * @returns The result of `rejectWithValue` with a structured error payload, which keeps a
 * `CommandError`'s validation details.
 */
export function handleThunkError<R>(
  e: unknown,
  context: string,
  rejectWithValue: (value: ThunkRejectValue) => R,
  superseded = false,
): R {
  const detail = e instanceof Error ? e.message : JSON.stringify(e);
  const errorMessage = `${context} Error: ${detail}`;
  error(errorMessage);
  const value: ThunkRejectValue =
    e instanceof CommandError
      ? { code: e.code, message: errorMessage }
      : { code: ErrorCode.other, message: errorMessage };
  if (e instanceof CommandError && e.details) {
    value.details = e.details;
  }
  if (superseded) {
    value.superseded = true;
  }
  return rejectWithValue(value);
}
