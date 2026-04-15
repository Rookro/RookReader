import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as FontCommands from "./FontCommands";

// Explicitly unmock the module being tested to avoid conflict with global mocks in setup.ts
vi.unmock("./FontCommands");

describe("FontCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getFonts should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(["Font A"]);
    const result = await FontCommands.getFonts();
    expect(invoke).toHaveBeenCalledWith("get_fonts");
    expect(result).toEqual(["Font A"]);
  });

  it("should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(FontCommands.getFonts()).rejects.toThrow(CommandError);
  });
});
