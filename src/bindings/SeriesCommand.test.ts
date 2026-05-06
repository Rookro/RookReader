import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as SeriesCommand from "./SeriesCommand";

vi.unmock("./SeriesCommand");

describe("SeriesCommand", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  const mockError = { code: 123, message: "Fail" };

  describe("createSeries", () => {
    it("should call invoke with correct arguments and return the ID", async () => {
      vi.mocked(invoke).mockResolvedValue(1);

      const result = await SeriesCommand.createSeries("Test Series");

      expect(invoke).toHaveBeenCalledWith("create_series", { name: "Test Series" });
      expect(result).toBe(1);
    });

    it("should throw CommandError on failure", async () => {
      vi.mocked(invoke).mockRejectedValue(mockError);

      await expect(SeriesCommand.createSeries("Test Series")).rejects.toThrow(CommandError);
    });
  });

  describe("getAllSeries", () => {
    it("should call invoke and return all series", async () => {
      const mockSeries = [
        { id: 1, name: "Series 1" },
        { id: 2, name: "Series 2" },
      ];
      vi.mocked(invoke).mockResolvedValue(mockSeries);

      const result = await SeriesCommand.getAllSeries();

      expect(invoke).toHaveBeenCalledWith("get_all_series");
      expect(result).toEqual(mockSeries);
    });

    it("should throw CommandError on failure", async () => {
      vi.mocked(invoke).mockRejectedValue(mockError);

      await expect(SeriesCommand.getAllSeries()).rejects.toThrow(CommandError);
    });
  });

  describe("deleteSeries", () => {
    it("should call invoke with correct ID", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await SeriesCommand.deleteSeries(1);

      expect(invoke).toHaveBeenCalledWith("delete_series", { id: 1 });
    });

    it("should throw CommandError on failure", async () => {
      vi.mocked(invoke).mockRejectedValue(mockError);

      await expect(SeriesCommand.deleteSeries(1)).rejects.toThrow(CommandError);
    });
  });
});
