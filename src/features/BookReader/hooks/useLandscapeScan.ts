import { warn } from "@tauri-apps/plugin-log";
import { useEffect, useMemo, useRef, useState } from "react";
import { updatePageLayout } from "../../../bindings/BookCommands";
import type { BookWithState } from "../../../bindings/bindings";
import { getImageDimensions } from "../../../bindings/ContainerCommands";
import { perf, perfSince, perfStart } from "../../../utils/perf";

/** What {@link useLandscapeScan} needs to know about the open book. */
export interface LandscapeScanOptions {
  /** The path of the container file. */
  containerPath: string;
  /** The number of pages in the book. */
  pageCount: number;
  /** The open book's record, carrying any stored measurement and the id to store one under. */
  book?: BookWithState | null;
}

/**
 * Measures which of a book's pages are landscape, and remembers the measurement on the
 * book's record so it is never scanned again.
 *
 * @param options See {@link LandscapeScanOptions}.
 * @returns Whether each page is wider than it is tall, in entry order, or null until the
 * book has been measured.
 */
export const useLandscapeScan = ({
  containerPath,
  pageCount,
  book,
}: LandscapeScanOptions): boolean[] | null => {
  const [scannedLandscape, setScannedLandscape] = useState<{
    path: string;
    landscape: boolean[];
  } | null>(null);
  // The book whose measurement has already been written back, so a re-render cannot
  // write it twice.
  const savedLayoutRef = useRef<string | null>(null);

  // The book as already measured, when the stored bits describe *this* book. Bits of a
  // different length belong to a book whose pages have changed since.
  const cachedLandscape = useMemo(() => {
    const bits = book?.landscape_bits;
    return bits && bits.length === pageCount ? Array.from(bits, (bit) => bit === "1") : null;
  }, [book, pageCount]);

  // Measure the book, unless it already carries its measurement. Skipping the scan for a
  // known book is what takes a full re-measure off every reopen.
  useEffect(() => {
    setScannedLandscape(null);
    if (!containerPath || pageCount === 0 || cachedLandscape) {
      if (cachedLandscape) {
        // The measurement arrived with the book, so there is no scan to wait for. This
        // is the line that says a reopen cost nothing.
        perf("chain", `source=cached pages=${cachedLandscape.length}`, 0);
      }
      return;
    }

    let cancelled = false;
    const started = perfStart();
    getImageDimensions(containerPath)
      .then((dims) => {
        if (!cancelled) {
          perf("chain", `source=scanned pages=${dims.length}`, perfSince(started) ?? 0);
          setScannedLandscape({
            path: containerPath,
            landscape: dims.map((page) => page.width > page.height),
          });
        }
      })
      .catch((e) => {
        warn(`Failed to scan image dimensions: ${String(e)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [containerPath, pageCount, cachedLandscape]);

  // One value, two origins. A scan belonging to another book, or reporting a different
  // page count, is ignored: it cannot describe this one.
  const landscape = useMemo(() => {
    if (cachedLandscape) {
      return cachedLandscape;
    }
    if (
      !scannedLandscape ||
      scannedLandscape.path !== containerPath ||
      scannedLandscape.landscape.length !== pageCount
    ) {
      return null;
    }
    return scannedLandscape.landscape;
  }, [cachedLandscape, scannedLandscape, containerPath, pageCount]);

  // Remember the measurement so this book never has to be scanned again. Only a fully
  // successful scan is written back: a page that failed once, and so measured as 0x0,
  // must not fix the book's pairing forever.
  useEffect(() => {
    const id = book?.id;
    if (
      id === undefined ||
      !scannedLandscape ||
      scannedLandscape.path !== containerPath ||
      scannedLandscape.landscape.length !== pageCount ||
      savedLayoutRef.current === containerPath
    ) {
      return;
    }
    savedLayoutRef.current = containerPath;
    const bits = scannedLandscape.landscape.map((bit) => (bit ? "1" : "0")).join("");
    updatePageLayout(id, bits).catch((e: unknown) => {
      warn(`Failed to store the page layout: ${String(e)}`);
    });
  }, [book, scannedLandscape, containerPath, pageCount]);

  return landscape;
};
