import { error } from "@tauri-apps/plugin-log";
import { describe, expect, it, vi } from "vitest";
import { CommandError, ErrorCode } from "../types/Error";
import { handleThunkError, recordThunkError } from "./thunkErrorHandler";

// Mock Tauri logger plugin
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}));

describe("handleThunkError", () => {
  it("should handle CommandError and reject with the error code and message", () => {
    const commandError = new CommandError(ErrorCode.database, "DB fail");

    const result = handleThunkError(commandError, "Fetch Books", (value) => value);

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Fetch Books Error:"));
    expect(result).toEqual({
      code: ErrorCode.database,
      // The original (non-enumerable) Error.message must be preserved, not dropped by JSON.stringify.
      message: expect.stringContaining("DB fail"),
    });
  });

  it("should handle non-CommandError and reject with ErrorCode.other", () => {
    const genericError = new Error("Generic failure");

    const result = handleThunkError(genericError, "Load Tags", (value) => value);

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Load Tags Error:"));
    expect(result).toEqual({
      code: ErrorCode.other,
      // The original Error.message must survive instead of being stringified to "{}".
      message: expect.stringContaining("Generic failure"),
    });
  });

  it("should JSON.stringify a non-Error value as the detail", () => {
    const result = handleThunkError({ foo: 1 }, "Plain Object", (value) => value);

    expect(result).toEqual({
      code: ErrorCode.other,
      message: expect.stringContaining('{"foo":1}'),
    });
  });

  it("keeps a CommandError's validation details", () => {
    const details = [
      { path: "reader.novel.fontSize", kind: "outOfRange" as const, min: 1, max: 200 },
    ];
    const result = handleThunkError(
      new CommandError(ErrorCode.settingsValidation, "bad", details),
      "Save",
      (value) => value,
    );
    expect(result).toStrictEqual({
      code: ErrorCode.settingsValidation,
      message: "Save Error: bad",
      details,
    });
  });
});

describe("recordThunkError", () => {
  it("stores the rejection's payload as the error", () => {
    const state = { error: null };
    recordThunkError(state, { payload: { code: ErrorCode.other, message: "m" } });
    expect(state.error).toEqual({ code: ErrorCode.other, message: "m" });
  });

  it("clears the error when the rejection has no payload", () => {
    const state = { error: { code: ErrorCode.other } };
    recordThunkError(state, {});
    expect(state.error).toBeNull();
  });
});
