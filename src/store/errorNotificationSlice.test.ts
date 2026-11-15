import { describe, expect, it } from "vitest";
import { ErrorCode } from "../types/Error";
import reducer, { errorReported, errorsShown } from "./errorNotificationSlice";

const rejected = (type: string, payload: unknown) => ({
  type: `${type}/rejected`,
  payload,
  meta: { rejectedWithValue: true, requestId: "r", requestStatus: "rejected", arg: undefined },
  error: { message: "Rejected" },
});

describe("errorNotificationSlice", () => {
  it("collects a rejected thunk under its slice's context", () => {
    const state = reducer(
      undefined,
      rejected("tag/fetchTags", { code: ErrorCode.database, message: "locked" }),
    );
    expect(state.pending).toEqual([{ context: "tag", code: ErrorCode.database }]);
  });

  it.each([
    ["reader/loadBook", "open-container"],
    ["fileNavigator/loadDirectory", "explorer"],
    ["history/clearHistory", "history"],
    ["collection/addCollection", "bookshelf"],
    ["series/addSeries", "series"],
    ["bookmark/addBookmark", "bookmark"],
    ["settings/updateSettings", "settings-save"],
  ])("maps %s to %s", (type, context) => {
    const state = reducer(undefined, rejected(type, { code: ErrorCode.io }));
    expect(state.pending).toEqual([{ context, code: ErrorCode.io }]);
  });

  it("ignores a slice with no message context", () => {
    const state = reducer(undefined, rejected("view/anything", { code: ErrorCode.io }));
    expect(state.pending).toEqual([]);
  });

  it("skips a superseded rejection", () => {
    const state = reducer(
      undefined,
      rejected("fileNavigator/loadDirectory", { code: ErrorCode.io, superseded: true }),
    );
    expect(state.pending).toEqual([]);
  });

  it("skips a rejection that carries field violations", () => {
    const details = [{ path: "reader.novel.fontSize", kind: "outOfRange", min: 1, max: 200 }];
    const state = reducer(
      undefined,
      rejected("settings/updateSettings", { code: ErrorCode.settingsValidation, details }),
    );
    expect(state.pending).toEqual([]);
  });

  it("ignores a rejection without a value", () => {
    const action = { ...rejected("tag/fetchTags", undefined), meta: { rejectedWithValue: false } };
    expect(reducer(undefined, action).pending).toEqual([]);
  });

  it("queues a reported error and empties on errorsShown", () => {
    let state = reducer(
      undefined,
      errorReported({ context: "record-book", code: ErrorCode.database }),
    );
    expect(state.pending).toEqual([{ context: "record-book", code: ErrorCode.database }]);
    state = reducer(state, errorsShown());
    expect(state.pending).toEqual([]);
  });
});
