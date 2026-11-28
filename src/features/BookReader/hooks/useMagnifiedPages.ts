import { warn } from "@tauri-apps/plugin-log";
import { useCallback, useEffect, useRef, useState } from "react";
import { createBlobUrl, fetchImageMagnifiedBlob } from "../utils/ImageUtils";
import { decodeImage } from "../utils/pageLoading";
import type { DisplaySize } from "./useDisplaySize";

const NONE: ReadonlyMap<string, HTMLImageElement> = new Map();

/**
 * Fetches and holds decoded magnified images for the pages currently on screen.
 *
 * Pages are kept while they remain on screen (even across closing and reopening the
 * loupe) and released as soon as they leave the screen or the book, zoom, or reported
 * viewport size changes.
 *
 * @param containerPath The path of the open container.
 * @param firstEntry The entry name of the first displayed page, if loaded.
 * @param secondEntry The entry name of the second displayed page in a spread, if loaded.
 * @param zoom The loupe's magnification factor.
 * @param reportedSize The viewport size the backend has accepted, or null before it has.
 * @param isLoupeEnabled Whether the loupe is currently open.
 * @returns A map from entry name to decoded `HTMLImageElement` holding its blob URL.
 */
export function useMagnifiedPages(
  containerPath: string,
  firstEntry: string | undefined,
  secondEntry: string | undefined,
  zoom: number,
  reportedSize: DisplaySize | null,
  isLoupeEnabled: boolean,
): ReadonlyMap<string, HTMLImageElement> {
  const [pages, setPages] = useState<ReadonlyMap<string, HTMLImageElement>>(NONE);
  const held = useRef(new Map<string, HTMLImageElement>());
  const inFlight = useRef(new Set<string>());
  const generation = useRef(0);
  const onScreen = useRef<string[]>([]);
  const key = reportedSize
    ? `${containerPath}\n${zoom}\n${reportedSize.width}x${reportedSize.height}`
    : null;

  const publish = useCallback(
    () => setPages(held.current.size === 0 ? NONE : new Map(held.current)),
    [],
  );
  const release = useCallback((entry: string) => {
    const image = held.current.get(entry);
    if (image) {
      URL.revokeObjectURL(image.src);
      held.current.delete(entry);
    }
  }, []);

  // What is held was rendered for one book, zoom and size; anything else is wrong.
  // Declared first: on a commit that changes both, this runs before the fetch below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the key changes.
  useEffect(() => {
    generation.current += 1;
    inFlight.current.clear();
    for (const entry of [...held.current.keys()]) release(entry);
    publish();
  }, [key]);

  useEffect(() => {
    const now = [firstEntry, secondEntry].filter((entry): entry is string => entry !== undefined);
    onScreen.current = now;
    const gone = [...held.current.keys()].filter((entry) => !now.includes(entry));
    for (const entry of gone) release(entry);
    if (gone.length > 0) publish();
  }, [firstEntry, secondEntry, release, publish]);

  useEffect(() => {
    if (!isLoupeEnabled || key === null) return;
    const ticket = generation.current;
    const entries = [firstEntry, secondEntry].filter(
      (entry): entry is string => entry !== undefined,
    );
    for (const entry of entries) {
      if (held.current.has(entry) || inFlight.current.has(entry)) continue;
      inFlight.current.add(entry);
      fetchImageMagnifiedBlob(containerPath, entry, zoom)
        .then(async (image) => {
          const stale = () =>
            ticket !== generation.current ||
            !onScreen.current.includes(entry) ||
            held.current.has(entry);
          // Checked before decoding too: a page turned away from is not worth the decode.
          if (!image || stale()) return;
          const url = createBlobUrl(image);
          const decoded = await decodeImage(url);
          if (!decoded || stale()) {
            URL.revokeObjectURL(url);
            return;
          }
          held.current.set(entry, decoded);
          publish();
        })
        .catch((e) => warn(`Failed to load ${entry} magnified: ${String(e)}`))
        .finally(() => {
          if (ticket === generation.current) inFlight.current.delete(entry);
        });
    }
  }, [isLoupeEnabled, key, firstEntry, secondEntry, containerPath, zoom, publish]);

  useEffect(
    () => () => {
      generation.current += 1;
      for (const image of held.current.values()) URL.revokeObjectURL(image.src);
      held.current.clear();
      inFlight.current.clear();
    },
    [],
  );

  return pages;
}
