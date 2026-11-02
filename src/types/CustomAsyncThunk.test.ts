import { error } from "@tauri-apps/plugin-log";
import { describe, expect, it, vi } from "vitest";
import { createCommandThunk } from "./CustomAsyncThunk";
import { CommandError, ErrorCode } from "./Error";

// Mock Tauri logger plugin
vi.mock("@tauri-apps/plugin-log", () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}));

describe("createCommandThunk", () => {
  it("fulfils with what the payload creator returns", async () => {
    const double = createCommandThunk(
      "test/double",
      async (n: number) => n * 2,
      () => "Failed.",
    );
    const action = await double(3)(vi.fn(), vi.fn(), undefined);
    expect(double.fulfilled.match(action)).toBe(true);
    expect(action.payload).toBe(6);
  });

  it("rejects with the described, logged error when the payload creator throws", async () => {
    const load = createCommandThunk(
      "test/load",
      async (_id: number) => {
        throw new CommandError(ErrorCode.database, "DB fail");
      },
      (id) => `Failed to load(id: ${id}).`,
    );
    const action = await load(7)(vi.fn(), vi.fn(), undefined);
    expect(load.rejected.match(action)).toBe(true);
    // Strict: a payload without details has no `details: undefined` key.
    expect(action.payload).toStrictEqual({
      code: ErrorCode.database,
      message: "Failed to load(id: 7). Error: DB fail",
    });
    expect(error).toHaveBeenCalledWith("Failed to load(id: 7). Error: DB fail");
  });
});
