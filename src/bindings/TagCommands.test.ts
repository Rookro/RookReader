import { describe, it, expect, vi, beforeEach } from "vitest";
import * as TagCommands from "./TagCommands";
import { invoke } from "@tauri-apps/api/core";
import { CommandError } from "../types/Error";

vi.unmock("./TagCommands");

describe("TagCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAllTags should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await TagCommands.getAllTags();
    expect(invoke).toHaveBeenCalledWith("get_all_tags");
  });

  it("createTag should call invoke", async () => {
    const mockTag = { id: 1, name: "Tag", color_code: "#000" };
    vi.mocked(invoke).mockResolvedValue(mockTag);
    const result = await TagCommands.createTag("Tag", "#000");
    expect(invoke).toHaveBeenCalledWith("create_tag", { name: "Tag", colorCode: "#000" });
    expect(result).toEqual(mockTag);
  });

  it("deleteTag should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await TagCommands.deleteTag(1);
    expect(invoke).toHaveBeenCalledWith("delete_tag", { id: 1 });
  });

  it("createTag should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(TagCommands.createTag("T", "#000")).rejects.toThrow(CommandError);
  });

  it("deleteTag should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(TagCommands.deleteTag(1)).rejects.toThrow(CommandError);
  });

  it("should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(TagCommands.getAllTags()).rejects.toThrow(CommandError);
  });
});
