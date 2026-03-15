import { createAsyncThunk } from "@reduxjs/toolkit";
import { AppDispatch, RootState } from "../Store";
import { ErrorCode } from "./Error";

/** Creates a typed async thunk with app-specific types. */
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: { code: ErrorCode; message?: string };
}>();
