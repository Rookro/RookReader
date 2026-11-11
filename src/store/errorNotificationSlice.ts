import { createSlice, isRejectedWithValue, type PayloadAction } from "@reduxjs/toolkit";
import type { ThunkRejectValue } from "../types/CustomAsyncThunk";
import type { ErrorCode } from "../types/Error";
import type { ErrorContext } from "../types/ErrorContext";

/** An error waiting to be shown to the user. */
export type ErrorNotification = { context: ErrorContext; code: ErrorCode };

/** The message context of each slice whose failed thunks are shown to the user. */
const CONTEXT_BY_SLICE: Partial<Record<string, ErrorContext>> = {
  reader: "open-container",
  fileNavigator: "explorer",
  history: "history",
  collection: "bookshelf",
  tag: "tag",
  series: "series",
  bookmark: "bookmark",
  settings: "settings-save",
};

const errorNotificationSlice = createSlice({
  name: "errorNotification",
  initialState: { pending: [] as ErrorNotification[] },
  reducers: {
    /** Queues an error that did not come from a rejected thunk. */
    errorReported: (state, action: PayloadAction<ErrorNotification>) => {
      state.pending.push(action.payload);
    },
    /** Empties the queue once its errors have been shown. */
    errorsShown: (state) => {
      state.pending = [];
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(isRejectedWithValue, (state, action) => {
      const context = CONTEXT_BY_SLICE[action.type.split("/")[0]];
      const value = action.payload as ThunkRejectValue;
      // Field violations are shown beside their field.
      if (!context || value.superseded || value.details?.length) {
        return;
      }
      state.pending.push({ context, code: value.code });
    });
  },
});

export const { errorReported, errorsShown } = errorNotificationSlice.actions;
export default errorNotificationSlice.reducer;
