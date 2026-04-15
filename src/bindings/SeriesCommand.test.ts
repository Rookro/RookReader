import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as SeriesCommand from "./SeriesCommand";

vi.unmock("./SeriesCommand");

describe("SeriesCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAllSeries should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await SeriesCommand.getAllSeries();
    expect(invoke).toHaveBeenCalledWith("get_all_series");
  });

  it("createSeries should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(1);
    const result = await SeriesCommand.createSeries("Series");
    expect(invoke).toHaveBeenCalledWith("create_series", { name: "Series" });
    expect(result).toBe(1);
  });

  it("createSeries should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(SeriesCommand.createSeries("S")).rejects.toThrow(CommandError);
  });

  it("should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fail"));
    await expect(SeriesCommand.getAllSeries()).rejects.toThrow(CommandError);
  });
});
