import { useAppSelector } from "../../../store/store";
import type { Direction } from "../../../types/AppSettings";

/**
 * Direction assumed for a novel until its first section reports a writing mode.
 * The app targets Japanese books, whose novels are predominantly vertical.
 */
export const NOVEL_FALLBACK_DIRECTION: Direction = "rtl";

/**
 * Resolves the direction pages advance in for the book currently open.
 *
 * Comics follow the direction stored against the book, seeded from the
 * `reader.comic.readingDirection` default the first time the book is opened; that default
 * is the fallback while no book is loaded. Novels follow the direction detected from the
 * EPUB itself and cannot be overridden, because the page order of a vertically written
 * book is a property of the book, not a preference.
 *
 * @returns The effective reading direction.
 */
export const useReadingDirection = (): Direction => {
  const isNovel = useAppSelector((state) => state.read.containerFile.isNovel);
  const novelDirection = useAppSelector((state) => state.read.containerFile.novelDirection);
  const bookDirection = useAppSelector((state) => state.read.containerFile.readingDirection);
  const defaultDirection = useAppSelector((state) => state.settings.reader.comic.readingDirection);

  return isNovel
    ? (novelDirection ?? NOVEL_FALLBACK_DIRECTION)
    : (bookDirection ?? defaultDirection);
};
