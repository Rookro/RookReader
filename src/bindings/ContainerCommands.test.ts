import { describe, it, expect, vi, beforeEach } from "vitest";
import * as ContainerCommands from "./ContainerCommands";
import { invoke } from "@tauri-apps/api/core";
import { CommandError } from "../types/Error";

vi.unmock("./ContainerCommands");

describe("ContainerCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getEntriesInContainer should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue({ entries: ["1.jpg"], is_directory: false });
    await ContainerCommands.getEntriesInContainer("path", true);
    expect(invoke).toHaveBeenCalledWith("get_entries_in_container", {
      path: "path",
      enablePreload: true,
    });
  });

  it("getImage should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await ContainerCommands.getImage("path", "entry");
    expect(invoke).toHaveBeenCalledWith("get_image", { path: "path", entryName: "entry" });
  });

  it("getImagePreview should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(new ArrayBuffer(0));
    await ContainerCommands.getImagePreview("path", "entry");
    expect(invoke).toHaveBeenCalledWith("get_image_preview", { path: "path", entryName: "entry" });
  });

  it("setPdfRenderingHeight should call invoke", async () => {
    await ContainerCommands.setPdfRenderingHeight(1000);
    expect(invoke).toHaveBeenCalledWith("set_pdf_rendering_height", { height: 1000 });
  });

  it("setMaxImageHeight should call invoke", async () => {
    await ContainerCommands.setMaxImageHeight(2000);
    expect(invoke).toHaveBeenCalledWith("set_max_image_height", { height: 2000 });
  });

  it("setImageResizeMethod should call invoke", async () => {
    await ContainerCommands.setImageResizeMethod("lanczos3");
    expect(invoke).toHaveBeenCalledWith("set_image_resize_method", { method: "lanczos3" });
  });

  it("determineEpubNovel should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(true);
    const result = await ContainerCommands.determineEpubNovel("path");
    expect(invoke).toHaveBeenCalledWith("determine_epub_novel", { path: "path" });
    expect(result).toBe(true);
  });

  it("should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.getEntriesInContainer("path")).rejects.toThrow(CommandError);
  });

  it("getImage should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.getImage("path", "e")).rejects.toThrow(CommandError);
  });

  it("getImagePreview should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.getImagePreview("path", "e")).rejects.toThrow(CommandError);
  });

  it("setPdfRenderingHeight should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.setPdfRenderingHeight(100)).rejects.toThrow(CommandError);
  });

  it("setMaxImageHeight should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.setMaxImageHeight(100)).rejects.toThrow(CommandError);
  });

  it("setImageResizeMethod should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.setImageResizeMethod("m")).rejects.toThrow(CommandError);
  });

  it("determineEpubNovel should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.determineEpubNovel("p")).rejects.toThrow(CommandError);
  });
});
