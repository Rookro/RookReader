import { createAsyncThunk, type GetThunkAPI } from "@reduxjs/toolkit";
import type { SettingsValidationViolation } from "../bindings/bindings";
import type { AppDispatch, RootState } from "../store/store";
import { handleThunkError } from "../store/thunkErrorHandler";
import type { ErrorCode } from "./Error";

/** The value an app thunk rejects with. */
export type ThunkRejectValue = {
  code: ErrorCode;
  message?: string;
  /** Structured per-field validation details, present for settings validation errors. */
  details?: SettingsValidationViolation[];
};

type AppThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: ThunkRejectValue };

/** Creates a typed async thunk with app-specific types. */
export const createAppAsyncThunk = createAsyncThunk.withTypes<AppThunkConfig>();

/**
 * Creates an app thunk whose failures are logged and rejected with a {@link ThunkRejectValue}.
 *
 * @param typePrefix - The action type prefix.
 * @param payloadCreator - Does the thunk's work and returns its payload.
 * @param describeFailure - Describes a failure for the given argument; it prefixes the logged
 * and rejected message.
 * @returns The async thunk.
 */
export function createCommandThunk<Returned, Arg = void>(
  typePrefix: string,
  payloadCreator: (arg: Arg, api: GetThunkAPI<AppThunkConfig>) => Promise<Returned>,
  describeFailure: (arg: Arg) => string,
) {
  return createAppAsyncThunk<Returned, Arg>(typePrefix, async (arg, api) => {
    try {
      return await payloadCreator(arg, api);
    } catch (e) {
      return handleThunkError(e, describeFailure(arg), api.rejectWithValue);
    }
  });
}
