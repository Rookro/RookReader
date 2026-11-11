import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as ContainerCommands from "./ContainerCommands";

vi.unmock("./ContainerCommands");

describe("ContainerCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requestPreloadAround should call invoke", async () => {
    await ContainerCommands.requestPreloadAround("path", 5, 10, 2);
    expect(invoke).toHaveBeenCalledWith("request_preload_around", {
      path: "path",
      index: 5,
      bufferSize: 10,
      callerPages: 2,
    });
  });

  it("getImageDimensions should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([{ width: 100, height: 200 }]);
    const dimensions = await ContainerCommands.getImageDimensions("path");
    expect(invoke).toHaveBeenCalledWith("get_image_dimensions", { path: "path" });
    expect(dimensions).toEqual([{ width: 100, height: 200 }]);
  });

  it("getImageDimensions should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.getImageDimensions("path")).rejects.toThrow(CommandError);
  });

  it("requestPreloadAround should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(ContainerCommands.requestPreloadAround("path", 0, 10, 0)).rejects.toThrow(
      CommandError,
    );
  });
});
