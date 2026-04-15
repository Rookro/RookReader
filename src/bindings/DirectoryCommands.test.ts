import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as DirectoryCommands from "./DirectoryCommands";

vi.unmock("./DirectoryCommands");

describe("DirectoryCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getEntriesInDir should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await DirectoryCommands.getEntriesInDir("path");
    expect(invoke).toHaveBeenCalledWith("get_entries_in_dir", { dirPath: "path" });
  });

  it("should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(DirectoryCommands.getEntriesInDir("path")).rejects.toThrow(CommandError);
  });
});
