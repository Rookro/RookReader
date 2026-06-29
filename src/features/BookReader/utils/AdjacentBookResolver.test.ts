import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../../bindings/BookCommands";
import { createMockBookWithState } from "../../../test/factories";
import type { DirEntry } from "../../../types/DirEntry";
import * as DirEntryUtils from "../../../utils/DirEntryUtils";
import type { OpenOrigin } from "../types/OpenOrigin";
import { resolveAdjacentBook } from "./AdjacentBookResolver";

// convertEntriesInDir is not globally mocked; mock it so directory tests can control
// the returned entries directly without building binary buffers.
vi.mock("../../../utils/DirEntryUtils", () => ({
  convertEntriesInDir: vi.fn(),
}));

const dirEntry = (name: string, isDir = false): DirEntry => ({
  name,
  is_directory: isDir,
  last_modified: 0,
});

describe("resolveAdjacentBook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when currentPath is empty", async () => {
    const result = await resolveAdjacentBook(null, "", null, "next", "name_asc");
    expect(result).toBeNull();
  });

  describe("series priority (bookshelf origin only)", () => {
    const origin: OpenOrigin = { kind: "bookshelf", bookshelfId: 5, sortOrder: "name_asc" };
    const seriesBooks = [
      createMockBookWithState({ id: 1, series_id: 10, series_order: 1, file_path: "/s/v1.zip" }),
      createMockBookWithState({ id: 2, series_id: 10, series_order: 2, file_path: "/s/v2.zip" }),
      createMockBookWithState({
        id: 3,
        series_id: 10,
        series_order: 3,
        file_path: "/s/v3.zip",
        display_name: "Volume 3",
      }),
    ];

    it("resolves the next volume by series order", async () => {
      vi.mocked(BookCommands.getBooksWithStateBySeriesId).mockResolvedValue(seriesBooks);
      const current = seriesBooks[1];

      const result = await resolveAdjacentBook(
        current,
        current.file_path,
        origin,
        "next",
        "name_asc",
      );

      expect(BookCommands.getBooksWithStateBySeriesId).toHaveBeenCalledWith(10);
      expect(result).toEqual({ filePath: "/s/v3.zip", displayName: "Volume 3" });
    });

    it("resolves the previous volume by series order", async () => {
      vi.mocked(BookCommands.getBooksWithStateBySeriesId).mockResolvedValue(seriesBooks);
      const current = seriesBooks[1];

      const result = await resolveAdjacentBook(
        current,
        current.file_path,
        origin,
        "previous",
        "name_asc",
      );

      expect(result?.filePath).toBe("/s/v1.zip");
    });

    it("returns null at the series boundary (authoritative)", async () => {
      vi.mocked(BookCommands.getBooksWithStateBySeriesId).mockResolvedValue(seriesBooks);
      const current = seriesBooks[2]; // last volume

      const result = await resolveAdjacentBook(
        current,
        current.file_path,
        origin,
        "next",
        "name_asc",
      );

      expect(result).toBeNull();
    });

    it("prioritizes series over the bookshelf sort order", async () => {
      vi.mocked(BookCommands.getBooksWithStateBySeriesId).mockResolvedValue(seriesBooks);
      const current = seriesBooks[0];

      const result = await resolveAdjacentBook(
        current,
        current.file_path,
        origin,
        "next",
        "name_asc",
      );

      expect(result?.filePath).toBe("/s/v2.zip");
      expect(BookCommands.getBooksWithStateByBookshelfId).not.toHaveBeenCalled();
    });
  });

  describe("bookshelf context", () => {
    const origin: OpenOrigin = { kind: "bookshelf", bookshelfId: 5, sortOrder: "name_asc" };
    const shelfBooks = [
      createMockBookWithState({ id: 1, display_name: "B", file_path: "/lib/b.zip" }),
      createMockBookWithState({ id: 2, display_name: "A", file_path: "/lib/a.zip" }),
      createMockBookWithState({ id: 3, display_name: "C", file_path: "/lib/c.zip" }),
    ];
    // A standalone book (series_id null) so the bookshelf branch is taken.
    const current = createMockBookWithState({ id: 1, display_name: "B", file_path: "/lib/b.zip" });

    it("resolves the next book by bookshelf sort order", async () => {
      vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockResolvedValue(shelfBooks);

      const result = await resolveAdjacentBook(current, "/lib/b.zip", origin, "next", "name_asc");

      expect(BookCommands.getBooksWithStateByBookshelfId).toHaveBeenCalledWith(5);
      expect(result).toEqual({ filePath: "/lib/c.zip", displayName: "C" });
    });

    it("resolves the previous book by bookshelf sort order", async () => {
      vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockResolvedValue(shelfBooks);

      const result = await resolveAdjacentBook(
        current,
        "/lib/b.zip",
        origin,
        "previous",
        "name_asc",
      );

      expect(result).toEqual({ filePath: "/lib/a.zip", displayName: "A" });
    });

    it("uses getAllBooksWithState when bookshelfId is null", async () => {
      const allBooksOrigin: OpenOrigin = {
        kind: "bookshelf",
        bookshelfId: null,
        sortOrder: "name_asc",
      };
      vi.mocked(BookCommands.getAllBooksWithState).mockResolvedValue(shelfBooks);

      const result = await resolveAdjacentBook(
        current,
        "/lib/b.zip",
        allBooksOrigin,
        "next",
        "name_asc",
      );

      expect(BookCommands.getAllBooksWithState).toHaveBeenCalled();
      expect(result?.filePath).toBe("/lib/c.zip");
    });

    it("returns null when the current book is not found in the shelf", async () => {
      vi.mocked(BookCommands.getBooksWithStateByBookshelfId).mockResolvedValue(shelfBooks);

      const result = await resolveAdjacentBook(
        current,
        "/lib/missing.zip",
        origin,
        "next",
        "name_asc",
      );

      expect(result).toBeNull();
    });
  });

  describe("directory fallback", () => {
    const origin: OpenOrigin = { kind: "fileNavigator" };
    // A standalone book so the directory branch is taken.
    const current = createMockBookWithState({ series_id: null, file_path: "/dir/b.zip" });

    beforeEach(() => {
      // Unsorted. "vol3" is a directory book (DirectoryContainer) and must be a candidate.
      // Sorted by name_asc: a.zip, b.zip, c.zip, vol3 (dir).
      vi.mocked(DirEntryUtils.convertEntriesInDir).mockReturnValue([
        dirEntry("c.zip"),
        dirEntry("vol3", true),
        dirEntry("a.zip"),
        dirEntry("b.zip"),
      ]);
    });

    it("resolves the next entry using the File Navigator sort order", async () => {
      const result = await resolveAdjacentBook(current, "/dir/b.zip", origin, "next", "name_asc");
      expect(result).toEqual({ filePath: "/dir/c.zip", displayName: "c.zip" });
    });

    it("resolves the previous entry using the File Navigator sort order", async () => {
      const result = await resolveAdjacentBook(
        current,
        "/dir/b.zip",
        origin,
        "previous",
        "name_asc",
      );
      expect(result).toEqual({ filePath: "/dir/a.zip", displayName: "a.zip" });
    });

    it("honors a descending sort order (name_desc)", async () => {
      // Sorted by name_desc: vol3, c.zip, b.zip, a.zip -> "next" from b.zip is a.zip.
      const result = await resolveAdjacentBook(current, "/dir/b.zip", origin, "next", "name_desc");
      expect(result).toEqual({ filePath: "/dir/a.zip", displayName: "a.zip" });
    });

    it("includes directories as candidates (directory books)", async () => {
      const result = await resolveAdjacentBook(current, "/dir/c.zip", origin, "next", "name_asc");
      expect(result).toEqual({ filePath: "/dir/vol3", displayName: "vol3" });
    });

    it("resolves the next entry when the current book is itself a directory", async () => {
      const dirBook = createMockBookWithState({ series_id: null, file_path: "/dir/a.zip" });
      const result = await resolveAdjacentBook(
        dirBook,
        "/dir/vol3",
        origin,
        "previous",
        "name_asc",
      );
      // Going back from the directory book "vol3" lands on the preceding file "c.zip".
      expect(result).toEqual({ filePath: "/dir/c.zip", displayName: "c.zip" });
    });

    it("returns null at the end of the directory", async () => {
      const result = await resolveAdjacentBook(current, "/dir/vol3", origin, "next", "name_asc");
      expect(result).toBeNull();
    });

    it("is used for history origin as well", async () => {
      const result = await resolveAdjacentBook(
        current,
        "/dir/b.zip",
        { kind: "history" },
        "next",
        "name_asc",
      );
      expect(result?.filePath).toBe("/dir/c.zip");
    });

    it("ignores series metadata for a non-bookshelf origin", async () => {
      // A book registered in a series, but opened from the File Navigator: it should
      // follow the directory order, NOT the series order.
      const seriesBook = createMockBookWithState({
        series_id: 10,
        series_order: 2,
        file_path: "/dir/b.zip",
      });

      const result = await resolveAdjacentBook(
        seriesBook,
        "/dir/b.zip",
        origin,
        "next",
        "name_asc",
      );

      expect(result).toEqual({ filePath: "/dir/c.zip", displayName: "c.zip" });
      expect(BookCommands.getBooksWithStateBySeriesId).not.toHaveBeenCalled();
    });
  });
});
