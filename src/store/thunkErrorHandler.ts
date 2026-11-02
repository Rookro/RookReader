import { error } from "@tauri-apps/plugin-log";
import type { ThunkRejectValue } from "../types/CustomAsyncThunk";
import { CommandError, ErrorCode } from "../types/Error";

/**
 * Handles errors caught in async thunks by logging the error and returning
 * a properly formatted rejection value.
 *
 * @param e - The caught error.
 * @param context - A descriptive string for the error context (used in log messages).
 * @param rejectWithValue - The RTK `rejectWithValue` function from the thunk API.
 * @returns The result of `rejectWithValue` with a structured error payload, which keeps a
 * `CommandError`'s validation details.
 */
export function handleThunkError<R>(
  e: unknown,
  context: string,
  rejectWithValue: (value: ThunkRejectValue) => R,
): R {
  const detail = e instanceof Error ? e.message : JSON.stringify(e);
  const errorMessage = `${context} Error: ${detail}`;
  error(errorMessage);
  if (!(e instanceof CommandError)) {
    return rejectWithValue({ code: ErrorCode.other, message: errorMessage });
  }
  return rejectWithValue(
    e.details
      ? { code: e.code, message: errorMessage, details: e.details }
      : { code: e.code, message: errorMessage },
  );
}

/**
 * Stores a thunk rejection's payload as the slice's error, for rejected cases that do nothing else.
 *
 * @param state - The slice state.
 * @param action - The rejected action.
 */
export function recordThunkError(
  state: { error: ThunkRejectValue | null },
  action: { payload?: ThunkRejectValue },
): void {
  state.error = action.payload ?? null;
}
