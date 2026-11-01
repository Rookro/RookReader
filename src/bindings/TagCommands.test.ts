import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as TagCommands from "./TagCommands";

vi.unmock("./TagCommands");

describe("TagCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockError = { code: 123, message: "Fail" };

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

  it("getTagsForBook should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([1, 2, 3]);
    const result = await TagCommands.getTagsForBook(1);
    expect(invoke).toHaveBeenCalledWith("get_tags_for_book", { bookId: 1 });
    expect(result).toEqual([1, 2, 3]);
  });

  it("getTagsForBook should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(TagCommands.getTagsForBook(1)).rejects.toThrow(CommandError);
  });

  it("setTagsForBook should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await TagCommands.setTagsForBook(1, [1, 2]);
    expect(invoke).toHaveBeenCalledWith("set_tags_for_book", { bookId: 1, tagIds: [1, 2] });
  });

  it("setTagsForBook should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(TagCommands.setTagsForBook(1, [1])).rejects.toThrow(CommandError);
  });

  it("getBooksByTag should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await TagCommands.getBooksByTag(2);
    expect(invoke).toHaveBeenCalledWith("get_books_by_tag", { tagId: 2 });
  });

  it("getBooksByTag should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(TagCommands.getBooksByTag(1)).rejects.toThrow(CommandError);
  });
});
