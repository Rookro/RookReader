import { describe, expect, it } from "vitest";
import { isInsideArchive, isNavigableArchiveName } from "./ArchivePathUtils";

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

describe("isInsideArchive", () => {
  it.each([
    // The archive file itself is a real filesystem path, so it is not "inside".
    ["C:\\books\\comic.zip", false],
    ["/books/comic.zip", false],
    ["C:\\books\\comic.zip\\ch1", true],
    ["C:\\books\\comic.zip\\ch1\\part2", true],
    ["/books/comic.rar/ch1", true],
    ["C:\\books\\reading", false],
    // A PDF is never browsable, so a path below one is not an archive-inner path.
    ["C:\\books\\book.pdf\\ch1", false],
  ])("returns %s for %s", (path, expected) => {
    expect(isInsideArchive(path)).toBe(expected);
  });
});
