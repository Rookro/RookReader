import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as binaryApi from "./binaryApi";

vi.unmock("./binaryApi");

describe("binaryApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getImage should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryApi.getImage("path", "entry");
    expect(invoke).toHaveBeenCalledWith("get_image", { path: "path", entryName: "entry" });
  });

  it("getImage should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryApi.getImage("path", "e")).rejects.toThrow(CommandError);
  });

  it("getImageFull should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryApi.getImageFull("path", "entry");
    expect(invoke).toHaveBeenCalledWith("get_image_full", { path: "path", entryName: "entry" });
  });

  it("getImageFull should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryApi.getImageFull("path", "e")).rejects.toThrow(CommandError);
  });

  it("getImagePreview should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryApi.getImagePreview("path", "entry");
    expect(invoke).toHaveBeenCalledWith("get_image_preview", { path: "path", entryName: "entry" });
  });

  it("getImagePreview should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryApi.getImagePreview("path", "e")).rejects.toThrow(CommandError);
  });

  it("readNovelFile should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryApi.readNovelFile("novel.epub");
    expect(invoke).toHaveBeenCalledWith("read_novel_file", { path: "novel.epub" });
  });

  it("readNovelFile should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryApi.readNovelFile("novel.epub")).rejects.toThrow(CommandError);
  });

  it("getEntriesInDir should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryApi.getEntriesInDir("path");
    expect(invoke).toHaveBeenCalledWith("get_entries_in_dir", { dirPath: "path" });
  });

  it("getEntriesInDir should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryApi.getEntriesInDir("path")).rejects.toThrow(CommandError);
  });
});
