import { error } from "@tauri-apps/plugin-log";
import { describe, expect, it, vi } from "vitest";
import { CommandError, ErrorCode } from "../types/Error";
import { handleThunkError } from "./thunkErrorHandler";

// Mock Tauri logger plugin
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}));

describe("handleThunkError", () => {
  it("should handle CommandError and call rejectWithValue with the error code and message", () => {
    const mockRejectWithValue = vi.fn((val) => val);
    const commandError = new CommandError(ErrorCode.database, "DB fail");

    try {
      handleThunkError(commandError, "Fetch Books", mockRejectWithValue);
    } catch {
      // Expected to throw or return, but since we mock and cast as never, let's check output
    }

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Fetch Books Error:"));
    expect(mockRejectWithValue).toHaveBeenCalledWith({
      code: ErrorCode.database,
      // The original (non-enumerable) Error.message must be preserved, not dropped by JSON.stringify.
      message: expect.stringContaining("DB fail"),
    });
  });

  it("should handle non-CommandError and call rejectWithValue with ErrorCode.other", () => {
    const mockRejectWithValue = vi.fn((val) => val);
    const genericError = new Error("Generic failure");

    try {
      handleThunkError(genericError, "Load Tags", mockRejectWithValue);
    } catch {
      // Expected
    }

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Load Tags Error:"));
    expect(mockRejectWithValue).toHaveBeenCalledWith({
      code: ErrorCode.other,
      // The original Error.message must survive instead of being stringified to "{}".
      message: expect.stringContaining("Generic failure"),
    });
  });

  it("should JSON.stringify a non-Error value as the detail", () => {
    const mockRejectWithValue = vi.fn((val) => val);

    try {
      handleThunkError({ foo: 1 }, "Plain Object", mockRejectWithValue);
    } catch {
      // Expected
    }

    expect(mockRejectWithValue).toHaveBeenCalledWith({
      code: ErrorCode.other,
      message: expect.stringContaining('{"foo":1}'),
    });
  });
});
