import { createAsyncThunk } from "@reduxjs/toolkit";
import type { AppDispatch, RootState } from "../store/store";
import type { ErrorCode } from "./Error";

/** Creates a typed async thunk with app-specific types. */
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: { code: ErrorCode; message?: string };
}>();
