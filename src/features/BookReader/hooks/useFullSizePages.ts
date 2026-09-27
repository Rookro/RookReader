import { warn } from "@tauri-apps/plugin-log";
import { useEffect, useState } from "react";
import { createBlobUrl, fetchImageFullBlob } from "../utils/ImageUtils";

/** No page has a full-size copy. Shared so an idle loupe returns the same map. */
const NONE: ReadonlyMap<string, string> = new Map();

/**
 * Holds a full-size copy of the pages on screen, for as long as the loupe is open.
 *
 * Pages are otherwise rendered to fit the reader's viewport, which is the right size to
 * display and the wrong one to magnify: the loupe would show an upscale of what is
 * already on screen.
 *
 * On demand rather than always: a full-size page is several times the weight of a
 * displayed one, and the loupe is held open for a moment at a time.
 *
 * @param containerPath The path of the open container.
 * @param entries The entries currently on screen, at most two.
 * @param isLoupeEnabled Whether the loupe is open.
 * @returns The blob URL of each page that has a full-size copy, by entry name. A page
 *   missing from it has none — the caller falls back to the displayed one, which is
 *   softer under the lens but never blank.
 */
export function useFullSizePages(
  containerPath: string,
  entries: readonly string[],
  isLoupeEnabled: boolean,
): ReadonlyMap<string, string> {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(NONE);

  useEffect(() => {
    if (!isLoupeEnabled || entries.length === 0) {
      return;
    }

    let cancelled = false;
    const held = new Map<string, string>();

    for (const entry of entries) {
      fetchImageFullBlob(containerPath, entry)
        .then((image) => {
          if (!image) {
            return;
          }
          const url = createBlobUrl(image);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          held.set(entry, url);
          setUrls(new Map(held));
        })
        .catch((e) => {
          warn(`Failed to load ${entry} at full size: ${String(e)}`);
        });
    }

    return () => {
      cancelled = true;
      for (const url of held.values()) {
        URL.revokeObjectURL(url);
      }
      held.clear();
      setUrls(NONE);
    };
  }, [containerPath, entries, isLoupeEnabled]);

  return urls;
}
