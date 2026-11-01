import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as SeriesCommand from "./SeriesCommands";

vi.unmock("./SeriesCommands");

describe("SeriesCommand", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  const mockError = { code: 123, message: "Fail" };

  describe("createSeries", () => {
    it("should call invoke with correct arguments and return the new series", async () => {
      const created = { id: 1, name: "Test Series", created_at: "2026-03-01T15:30:00" };
      vi.mocked(invoke).mockResolvedValue(created);

      const result = await SeriesCommand.createSeries("Test Series");

      expect(invoke).toHaveBeenCalledWith("create_series", { name: "Test Series" });
      expect(result).toEqual(created);
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

  it("getBooksBySeries should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    await SeriesCommand.getBooksBySeries(3);
    expect(invoke).toHaveBeenCalledWith("get_books_by_series", { seriesId: 3 });
  });

  it("getBooksBySeries should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(SeriesCommand.getBooksBySeries(1)).rejects.toThrow(CommandError);
  });

  it("setSeriesForBook should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await SeriesCommand.setSeriesForBook(1, 10);
    expect(invoke).toHaveBeenCalledWith("set_series_for_book", { bookId: 1, seriesId: 10 });
  });

  it("setSeriesForBook should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(SeriesCommand.setSeriesForBook(1, 10)).rejects.toThrow(CommandError);
  });

  it("setSeriesOrder should call invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await SeriesCommand.setSeriesOrder([1, 2, 3]);
    expect(invoke).toHaveBeenCalledWith("set_series_order", { bookIds: [1, 2, 3] });
  });

  it("setSeriesOrder should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(SeriesCommand.setSeriesOrder([1, 2, 3])).rejects.toThrow(CommandError);
  });
});
