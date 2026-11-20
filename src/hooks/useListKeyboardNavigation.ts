import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { usePointerFocusRelease } from "./usePointerFocusRelease";

/** The `KeyboardEvent.key` values the list may handle; the dispatcher's recovery uses the same set. */
export const LIST_NAVIGATION_KEYS: ReadonlySet<string> = new Set([
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Enter",
  " ",
  "ArrowLeft",
  "ArrowRight",
]);

/** Same shape as the side pane's `PanelFocusRequest`, so a panel passes its request straight through. */
export type ListFocusRequest = "current" | "active" | "first" | { rowKey: string | number };

/** Options for {@link useListKeyboardNavigation}. */
export interface ListKeyboardNavigationOptions<K extends string | number> {
  /** The rows' stable keys in display order. */
  rowKeys: readonly K[];
  /** The panel's current row (open book, current page), or null. */
  currentKey: K | null;
  /** The listbox's accessible name. */
  label: string;
  /** Scrolls a row into view. */
  scrollToIndex: (index: number) => void;
  /** How many rows PageUp / PageDown move (at least 1). */
  pageSize: () => number;
  /** Opens a row, as a click does. */
  onOpen: (key: K, index: number) => void;
  /** → on a row; given only for lists whose rows can be entered. */
  onEnterRow?: (key: K, index: number) => void;
  /** ←; given only for lists that have a parent. */
  onLeave?: () => void;
  /** The last row disappeared while the list had focus. */
  onBecameEmpty?: () => void;
  /** Whether the keyboard, not the mouse, is in use (draws the active row as focused). */
  isKeyboardInUse: boolean;
}

/** What {@link useListKeyboardNavigation} returns. */
export interface ListKeyboardNavigation<K extends string | number> {
  /** The active row's key, or null when there is none. */
  activeKey: K | null;
  /** The active row's index, or -1 when there is none. */
  activeIndex: number;
  /** Whether the list container itself has DOM focus. */
  hasFocus: boolean;
  /** Whether row `index` is drawn as keyboard-focused. */
  isKeyboardActive: (index: number) => boolean;
  /** Makes a row active (a mouse click); stops following the current row. */
  setActiveKey: (key: K) => void;
  /** Focuses the list on a row; false when it has no rows, so the caller focuses its empty target. */
  focusList: (request: ListFocusRequest) => boolean;
  /** The id of row `index`, for its `id` attribute. */
  rowId: (index: number) => string;
  /** Spread onto the list container (react-window `List`, or the MUI `List`). */
  listProps: {
    id: string;
    role: "listbox";
    tabIndex: 0;
    "aria-label": string;
    "aria-activedescendant": string | undefined;
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
    onFocus: (e: React.FocusEvent<HTMLElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLElement>) => void;
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  };
  /** For react-window's `onRowsRendered`; lists that render every row leave it unused. */
  onRowsRendered: (
    visibleRows: { startIndex: number; stopIndex: number },
    allRows: { startIndex: number; stopIndex: number },
  ) => void;
}

interface ActiveRow<K> {
  key: K;
  /** The key's index the last time it was present. */
  index: number;
}

interface RowRange {
  startIndex: number;
  stopIndex: number;
}

/**
 * Keyboard navigation for a list in the WAI-ARIA listbox pattern: the container keeps DOM focus
 * and points at the active row with `aria-activedescendant`, so virtualized rows can unmount.
 *
 * @param options - The rows, the current row, and how to scroll, open, enter and leave rows.
 * @returns The active row, the props for the list container, and the focus and row helpers.
 */
export function useListKeyboardNavigation<K extends string | number>(
  options: ListKeyboardNavigationOptions<K>,
): ListKeyboardNavigation<K> {
  const {
    rowKeys,
    currentKey,
    label,
    scrollToIndex,
    pageSize,
    onOpen,
    onEnterRow,
    onLeave,
    isKeyboardInUse,
  } = options;
  const listId = useId();
  const [active, setActive] = useState<ActiveRow<K> | null>(null);
  const [hasFocus, setHasFocus] = useState(false);
  const [renderedRows, setRenderedRows] = useState<RowRange | null>(null);
  const followCurrentRef = useRef(false);
  // Set while focusList focuses the list, whose row it has already chosen.
  const focusingRef = useRef(false);
  const { onPointerDown, onFocus: releasePointerFocus, forgetPress } = usePointerFocusRelease();
  // Kept apart from `hasFocus` because an unmounted list fires no blur.
  const focusedRef = useRef(false);
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  if (active !== null) {
    const index = rowKeys.indexOf(active.key);
    if (index !== active.index) {
      if (index !== -1) {
        setActive({ key: active.key, index });
      } else if (rowKeys.length === 0) {
        setActive(null);
      } else {
        const next = Math.min(active.index, rowKeys.length - 1);
        setActive({ key: rowKeys[next], index: next });
      }
    }
  }
  const activeKey = active?.key ?? null;
  const activeIndex = active?.index ?? -1;

  const currentIndex = currentKey === null ? -1 : rowKeys.indexOf(currentKey);
  useEffect(() => {
    if (!followCurrentRef.current || currentKey === null || currentIndex === -1) return;
    setActive({ key: currentKey, index: currentIndex });
    optionsRef.current.scrollToIndex(currentIndex);
  }, [currentKey, currentIndex]);

  const isEmpty = rowKeys.length === 0;
  useEffect(() => {
    if (!isEmpty || !focusedRef.current) return;
    focusedRef.current = false;
    setHasFocus(false);
    optionsRef.current.onBecameEmpty?.();
  }, [isEmpty]);

  const rowId = useCallback((index: number) => `${listId}-row-${index}`, [listId]);

  const setActiveKey = useCallback(
    (key: K) => {
      const index = rowKeys.indexOf(key);
      if (index === -1) return;
      followCurrentRef.current = false;
      setActive({ key, index });
    },
    [rowKeys],
  );

  const focusList = useCallback(
    (request: ListFocusRequest) => {
      if (rowKeys.length === 0) return false;
      const keys: readonly (string | number)[] = rowKeys;
      let requested: number;
      if (request === "current") requested = currentIndex;
      else if (request === "active") requested = activeIndex;
      else if (request === "first") requested = 0;
      else requested = keys.indexOf(request.rowKey);
      const index = requested === -1 ? 0 : requested;

      followCurrentRef.current = request === "current";
      forgetPress();
      setActive({ key: rowKeys[index], index });
      focusingRef.current = true;
      document.getElementById(listId)?.focus({ preventScroll: true });
      focusingRef.current = false;
      scrollToIndex(index);
      return true;
    },
    [rowKeys, currentIndex, activeIndex, listId, scrollToIndex, forgetPress],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // Keys from a row's menu or dialog bubble here through their portal.
      if (e.target !== e.currentTarget) return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.nativeEvent.isComposing) return;
      if (!LIST_NAVIGATION_KEYS.has(e.key) || rowKeys.length === 0) return;
      if ((e.key === "ArrowRight" && !onEnterRow) || (e.key === "ArrowLeft" && !onLeave)) return;
      e.preventDefault();

      const last = rowKeys.length - 1;
      let next: number;
      switch (e.key) {
        case "ArrowDown":
          next = activeIndex === -1 ? 0 : Math.min(activeIndex + 1, last);
          break;
        case "ArrowUp":
          next = activeIndex === -1 ? 0 : Math.max(activeIndex - 1, 0);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = last;
          break;
        case "PageDown":
          next = activeIndex === -1 ? 0 : Math.min(activeIndex + pageSize(), last);
          break;
        case "PageUp":
          next = activeIndex === -1 ? 0 : Math.max(activeIndex - pageSize(), 0);
          break;
        case "Enter":
          if (active) onOpen(active.key, active.index);
          return;
        case "ArrowRight":
          if (active && onEnterRow) onEnterRow(active.key, active.index);
          return;
        case "ArrowLeft":
          onLeave?.();
          return;
        default:
          return;
      }
      followCurrentRef.current = false;
      setActive({ key: rowKeys[next], index: next });
      scrollToIndex(next);
    },
    [rowKeys, active, activeIndex, pageSize, onOpen, onEnterRow, onLeave, scrollToIndex],
  );

  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (releasePointerFocus(e) || e.target !== e.currentTarget) return;
      focusedRef.current = true;
      setHasFocus(true);
      // Tab lands on the current row, as entering the pane does.
      if (active === null && !focusingRef.current && rowKeys.length > 0) {
        const index = currentIndex === -1 ? 0 : currentIndex;
        followCurrentRef.current = true;
        setActive({ key: rowKeys[index], index });
        scrollToIndex(index);
      }
    },
    [releasePointerFocus, active, rowKeys, currentIndex, scrollToIndex],
  );

  const onBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    focusedRef.current = false;
    setHasFocus(false);
  }, []);

  const onRowsRendered = useCallback((_visibleRows: RowRange, allRows: RowRange) => {
    setRenderedRows((prev) =>
      prev?.startIndex === allRows.startIndex && prev.stopIndex === allRows.stopIndex
        ? prev
        : { startIndex: allRows.startIndex, stopIndex: allRows.stopIndex },
    );
  }, []);

  const isKeyboardActive = useCallback(
    (index: number) => hasFocus && isKeyboardInUse && index === activeIndex,
    [hasFocus, isKeyboardInUse, activeIndex],
  );

  const isActiveRendered =
    activeIndex !== -1 &&
    (renderedRows === null ||
      (activeIndex >= renderedRows.startIndex && activeIndex <= renderedRows.stopIndex));

  return {
    activeKey,
    activeIndex,
    hasFocus,
    isKeyboardActive,
    setActiveKey,
    focusList,
    rowId,
    listProps: {
      id: listId,
      role: "listbox",
      tabIndex: 0,
      "aria-label": label,
      "aria-activedescendant": isActiveRendered ? rowId(activeIndex) : undefined,
      onKeyDown,
      onFocus,
      onBlur,
      onPointerDown,
    },
    onRowsRendered,
  };
}
