import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { error } from "@tauri-apps/plugin-log";
import { HistoryEntry } from "../types/HistoryEntry";
import { HistoryTable } from "../database/historyTable";

const historyTable = new HistoryTable();
await historyTable.init();

/** Arguments for upsertHistory function. */
interface UpsertArgs {
  /** The path of entry. */
  path: string;
  /** The type of entry. */
  type: "FILE" | "DIRECTORY";
  /** The index of entry. */
  index?: number;
}

export const upsertHistory = createAsyncThunk(
  "history/upsertHistory",
  async (upsertArgs: UpsertArgs, { rejectWithValue }) => {
    try {
      await historyTable.upsert(upsertArgs.path, upsertArgs.type, upsertArgs.index);
      const entries = await historyTable.selectOrderByLastOpenedAtDesc();
      return entries;
    } catch (e) {
      const errorMessage = `Failed to upsertHistory(${JSON.stringify(upsertArgs)}). Error: ${e}`;
      error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

export const updateHistoryEntries = createAsyncThunk(
  "history/updateHistoryEntries",
  async (_, { rejectWithValue }) => {
    try {
      const entries = await historyTable.selectOrderByLastOpenedAtDesc();
      return entries;
    } catch (e) {
      const errorMessage = `Failed to updateHistoryEntries(). Error: ${e}`;
      error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

export const deleteHistory = createAsyncThunk(
  "history/deleteHistory",
  async (id: number, { rejectWithValue }) => {
    try {
      await historyTable.delete(id);
      const entries = await historyTable.selectOrderByLastOpenedAtDesc();
      return entries;
    } catch (e) {
      const errorMessage = `Failed to deleteHistory(${id}). Error: ${e}`;
      error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

export const clearHistory = createAsyncThunk(
  "history/clearHistory",
  async (_, { rejectWithValue }) => {
    try {
      await historyTable.deleteAll();
    } catch (e) {
      const errorMessage = `Failed to clearHistory(). Error: ${e}`;
      error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

export const historySlice = createSlice({
  name: "history",
  initialState: {
    isHistoryEnabled: true,
    entries: [] as HistoryEntry[],
    error: null as string | null,
  },
  reducers: {
    setIsHistoryEnabled: (state, action: PayloadAction<boolean>) => {
      state.isHistoryEnabled = action.payload;
    },
    setHistoryEntries: (state, action: PayloadAction<HistoryEntry[]>) => {
      state.entries = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(upsertHistory.pending, (state) => {
        state.error = null;
      })
      .addCase(upsertHistory.fulfilled, (state, action: PayloadAction<HistoryEntry[]>) => {
        state.entries = action.payload;
        state.error = null;
      })
      .addCase(upsertHistory.rejected, (state, action) => {
        state.entries = [];
        state.error = action.payload as string;
      })
      .addCase(updateHistoryEntries.pending, (state) => {
        state.error = null;
      })
      .addCase(updateHistoryEntries.fulfilled, (state, action: PayloadAction<HistoryEntry[]>) => {
        state.entries = action.payload;
        state.error = null;
      })
      .addCase(updateHistoryEntries.rejected, (state, action) => {
        state.entries = [];
        state.error = action.payload as string;
      })
      .addCase(deleteHistory.pending, (state) => {
        state.error = null;
      })
      .addCase(deleteHistory.fulfilled, (state, action: PayloadAction<HistoryEntry[]>) => {
        state.entries = action.payload;
        state.error = null;
      })
      .addCase(deleteHistory.rejected, (state, action) => {
        state.entries = [];
        state.error = action.payload as string;
      })
      .addCase(clearHistory.pending, (state) => {
        state.error = null;
      })
      .addCase(clearHistory.fulfilled, (state, _action: PayloadAction<void>) => {
        state.entries = [];
        state.error = null;
      })
      .addCase(clearHistory.rejected, (state, action) => {
        state.entries = [];
        state.error = action.payload as string;
      });
  },
});

export const { setIsHistoryEnabled, setHistoryEntries } = historySlice.actions;
export default historySlice.reducer;
