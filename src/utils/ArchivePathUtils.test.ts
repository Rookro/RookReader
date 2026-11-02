import { describe, expect, it } from "vitest";
import { isNavigableArchiveName } from "./ArchivePathUtils";

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
