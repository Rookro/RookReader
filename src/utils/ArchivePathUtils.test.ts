import { describe, expect, it } from "vitest";
import { bookTitleFromPath, isNavigableArchiveName } from "./ArchivePathUtils";

describe("isNavigableArchiveName", () => {
  it.each([
    ["comic.zip", true],
    ["comic.ZIP", true],
    ["comic.cbz", true],
    ["comic.rar", true],
    ["comic.CBR", true],
    // Single documents, not folder trees.
    ["book.pdf", false],
    ["book.epub", false],
    ["folder", false],
    ["archive.zip.txt", false],
  ])("returns %s for %s", (name, expected) => {
    expect(isNavigableArchiveName(name)).toBe(expected);
  });
});

describe("bookTitleFromPath", () => {
  it.each([
    ["C:\\books\\comic.zip", "comic.zip"],
    ["/books/novel.epub", "novel.epub"],
    ["/books/Vol 1", "Vol 1"],
    ["C:\\books\\comic.zip\\", "comic.zip"],
    // A folder inside an archive is named from the archive down.
    ["C:\\books\\comic.zip\\Vol.1", "comic.zip/Vol.1"],
    ["/books/comic.cbz/part/ch2", "comic.cbz/part/ch2"],
    ["D:\\COMIC.RAR\\Vol.2", "COMIC.RAR/Vol.2"],
    // Named from the nearest archive.
    ["/books/set.zip/inner.zip/ch1", "inner.zip/ch1"],
  ])("names %s as %s", (path, expected) => {
    expect(bookTitleFromPath(path)).toBe(expected);
  });
});
