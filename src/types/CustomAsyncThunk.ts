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
  /** Set when a newer request replaced this one, so its failure is not shown. */
  superseded?: true;
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
 * @param isSuperseded - Tells, after a failure, whether a newer request replaced this one; a
 * superseded rejection is marked so that it is not shown. Omitted, no rejection is superseded.
 * @returns The async thunk.
 */
export function createCommandThunk<Returned, Arg = void>(
  typePrefix: string,
  payloadCreator: (arg: Arg, api: GetThunkAPI<AppThunkConfig>) => Promise<Returned>,
  describeFailure: (arg: Arg) => string,
  isSuperseded?: (arg: Arg, api: GetThunkAPI<AppThunkConfig>) => boolean,
) {
  return createAppAsyncThunk<Returned, Arg>(typePrefix, async (arg, api) => {
    try {
      return await payloadCreator(arg, api);
    } catch (e) {
      return handleThunkError(
        e,
        describeFailure(arg),
        api.rejectWithValue,
        isSuperseded?.(arg, api) ?? false,
      );
    }
  });
}
