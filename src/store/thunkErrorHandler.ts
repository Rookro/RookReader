import { error } from "@tauri-apps/plugin-log";
import { CommandError, ErrorCode } from "../types/Error";

/**
 * Handles errors caught in async thunks by logging the error and returning
 * a properly formatted rejection value.
 *
 * @param e - The caught error.
 * @param context - A descriptive string for the error context (used in log messages).
 * @param rejectWithValue - The RTK `rejectWithValue` function from the thunk API.
 * @returns The result of `rejectWithValue` with a structured error payload.
 */
export function handleThunkError(
  e: unknown,
  context: string,
  rejectWithValue: (value: { code: ErrorCode; message: string }) => unknown,
): never {
  const detail = e instanceof Error ? e.message : JSON.stringify(e);
  const errorMessage = `${context} Error: ${detail}`;
  error(errorMessage);
  return rejectWithValue(
    e instanceof CommandError
      ? { code: e.code, message: errorMessage }
      : { code: ErrorCode.OTHER_ERROR, message: errorMessage },
  ) as never;
}
