import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as binaryCommands from "./binaryCommands";

vi.unmock("./binaryCommands");

describe("binaryCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getImage should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryCommands.getImage("path", "entry");
    expect(invoke).toHaveBeenCalledWith("get_image", { path: "path", entryName: "entry" });
  });

  it("getImage should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryCommands.getImage("path", "e")).rejects.toThrow(CommandError);
  });

  it("getImageFull should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryCommands.getImageFull("path", "entry");
    expect(invoke).toHaveBeenCalledWith("get_image_full", { path: "path", entryName: "entry" });
  });

  it("getImageFull should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryCommands.getImageFull("path", "e")).rejects.toThrow(CommandError);
  });

  it("getImagePreview should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryCommands.getImagePreview("path", "entry");
    expect(invoke).toHaveBeenCalledWith("get_image_preview", { path: "path", entryName: "entry" });
  });

  it("getImagePreview should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryCommands.getImagePreview("path", "e")).rejects.toThrow(CommandError);
  });

  it("readNovelFile should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryCommands.readNovelFile("novel.epub");
    expect(invoke).toHaveBeenCalledWith("read_novel_file", { path: "novel.epub" });
  });

  it("readNovelFile should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryCommands.readNovelFile("novel.epub")).rejects.toThrow(CommandError);
  });

  it("getEntriesInDir should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryCommands.getEntriesInDir("path");
    expect(invoke).toHaveBeenCalledWith("get_entries_in_dir", { dirPath: "path" });
  });

  it("getEntriesInDir should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryCommands.getEntriesInDir("path")).rejects.toThrow(CommandError);
  });
});
