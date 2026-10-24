import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { configure, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js";

/** Lists the files under `dir` as `/`-separated paths relative to it. */
function listFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const relative = prefix ? `${prefix}/${name}` : name;
    return statSync(path.join(dir, name)).isDirectory()
      ? listFiles(path.join(dir, name), relative)
      : [relative];
  });
}

/**
 * Zips an unpacked EPUB directory into an `.epub` file.
 *
 * `mimetype` goes first and uncompressed, as the EPUB container format requires.
 *
 * @param srcDir - The unpacked EPUB.
 * @param outFile - Where to write the `.epub`.
 * @param extraFiles - Files stored outside `srcDir`, keyed by their path in the EPUB.
 */
export async function packEpub(
  srcDir: string,
  outFile: string,
  extraFiles: Record<string, string> = {},
): Promise<void> {
  configure({ useWebWorkers: false });
  const writer = new ZipWriter(new Uint8ArrayWriter());
  const sources = new Map(listFiles(srcDir).map((file) => [file, path.join(srcDir, file)]));
  for (const [entry, source] of Object.entries(extraFiles)) {
    sources.set(entry, source);
  }
  const entries = [...sources.keys()].sort((a, b) =>
    a === "mimetype" ? -1 : b === "mimetype" ? 1 : a.localeCompare(b),
  );
  for (const entry of entries) {
    await writer.add(entry, new Uint8ArrayReader(readFileSync(sources.get(entry) as string)), {
      level: entry === "mimetype" ? 0 : 6,
    });
  }
  writeFileSync(outFile, await writer.close());
}
