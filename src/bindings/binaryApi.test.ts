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
    await binaryApi.getImage("path", "entry", 7);
    expect(invoke).toHaveBeenCalledWith("get_image", {
      path: "path",
      entryName: "entry",
      generation: 7,
    });
  });

  it("getImage should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryApi.getImage("path", "e", 1)).rejects.toThrow(CommandError);
  });

  it("getImageMagnified should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(8));
    await binaryApi.getImageMagnified("path", "entry", 2.5);
    expect(invoke).toHaveBeenCalledWith("get_image_magnified", {
      path: "path",
      entryName: "entry",
      zoom: 2.5,
    });
  });

  it("getImageMagnified should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryApi.getImageMagnified("path", "e", 2)).rejects.toThrow(CommandError);
  });

  it("getImagePreview should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await binaryApi.getImagePreview("path", "entry", 7);
    expect(invoke).toHaveBeenCalledWith("get_image_preview", {
      path: "path",
      entryName: "entry",
      generation: 7,
    });
  });

  it("getImagePreview should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(binaryApi.getImagePreview("path", "e", 1)).rejects.toThrow(CommandError);
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
