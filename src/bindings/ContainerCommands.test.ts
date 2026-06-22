import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as ContainerCommands from "./ContainerCommands";

vi.unmock("./ContainerCommands");

describe("ContainerCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getEntriesInContainer should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue({
      entries: ["1.jpg"],
      is_directory: false,
      is_novel: false,
    });
    await ContainerCommands.getEntriesInContainer("path");
    expect(invoke).toHaveBeenCalledWith("get_entries_in_container", {
      path: "path",
    });
  });

  it("requestPreloadAround should call invoke", async () => {
    await ContainerCommands.requestPreloadAround(5, 10);
    expect(invoke).toHaveBeenCalledWith("request_preload_around", {
      index: 5,
      bufferSize: 10,
    });
  });

  it("requestPreloadAround should call invoke with null bufferSize by default", async () => {
    await ContainerCommands.requestPreloadAround(5);
    expect(invoke).toHaveBeenCalledWith("request_preload_around", {
      index: 5,
      bufferSize: null,
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

  it("should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.getEntriesInContainer("path")).rejects.toThrow(CommandError);
  });

  it("requestPreloadAround should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.requestPreloadAround(0)).rejects.toThrow(CommandError);
  });

  it("getImage should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.getImage("path", "e")).rejects.toThrow(CommandError);
  });

  it("getImagePreview should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.getImagePreview("path", "e")).rejects.toThrow(CommandError);
  });

  it("should map structured error to CommandError", async () => {
    const structuredError = { code: 10001, message: "Unsupported container" };
    vi.mocked(invoke).mockRejectedValue(structuredError);

    try {
      await ContainerCommands.getEntriesInContainer("path");
    } catch (error) {
      expect(error).toBeInstanceOf(CommandError);
      const commandError = error as CommandError;
      expect(commandError.code).toBe(10001);
      expect(commandError.message).toBe("Unsupported container");
    }
  });

  it("should handle unknown error objects", async () => {
    vi.mocked(invoke).mockRejectedValue("string error");

    try {
      await ContainerCommands.getEntriesInContainer("path");
    } catch (error) {
      expect(error).toBeInstanceOf(CommandError);
      const commandError = error as CommandError;
      expect(commandError.code).toBe(90000); // UNKNOWN_ERROR
      expect(commandError.message).toContain("string error");
    }
  });
});
