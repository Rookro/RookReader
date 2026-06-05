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
    const commandError = new CommandError(ErrorCode.DATABASE_ERROR, "DB fail");

    try {
      handleThunkError(commandError, "Fetch Books", mockRejectWithValue);
    } catch {
      // Expected to throw or return, but since we mock and cast as never, let's check output
    }

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Fetch Books Error:"));
    expect(mockRejectWithValue).toHaveBeenCalledWith({
      code: ErrorCode.DATABASE_ERROR,
      message: expect.stringContaining("Fetch Books Error:"),
    });
  });

  it("should handle non-CommandError and call rejectWithValue with ErrorCode.OTHER_ERROR", () => {
    const mockRejectWithValue = vi.fn((val) => val);
    const genericError = new Error("Generic failure");

    try {
      handleThunkError(genericError, "Load Tags", mockRejectWithValue);
    } catch {
      // Expected
    }

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Load Tags Error:"));
    expect(mockRejectWithValue).toHaveBeenCalledWith({
      code: ErrorCode.OTHER_ERROR,
      message: expect.stringContaining("Load Tags Error:"),
    });
  });
});
