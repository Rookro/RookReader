import { readFile } from "@tauri-apps/plugin-fs";
import { error } from "@tauri-apps/plugin-log";
import type { TOCItem } from "foliate-js/epub.js";
import { Paginator } from "foliate-js/paginator.js";
import { type Book, makeBook, type View } from "foliate-js/view.js";
import { useCallback, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import BundledNotoSerifJP from "../../../assets/fonts/NotoSerifJP-VariableFont_wght.woff2";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { type AppDispatch, useAppSelector } from "../../../store/store";
import { setEntries, setNovelLocation } from "../slice";
import { usePageNavigation } from "./usePageNavigation";

/**
 * Builds a mapping of section indices to their corresponding Table of Contents (TOC) labels.
 * If multiple TOC items point to the same section, the first encountered label is kept.
 *
 * @param book - The parsed Book instance from foliate-js.
 * @returns A Map where the key is the section index and the value is the TOC label.
 */
const buildTocMap = (book: Book): Map<number, string> => {
  const map = new Map<number, string>();
  if (!book.toc || !book.resolveHref) return map;

  const traverse = (items: TOCItem[]) => {
    for (const item of items) {
      const resolved = book.resolveHref?.(item.href);
      if (resolved && resolved.index !== undefined && !map.has(resolved.index)) {
        map.set(resolved.index, item.label);
      }
      if (item.subitems && item.subitems.length > 0) {
        traverse(item.subitems);
      }
    }
  };

  traverse(book.toc);
  return map;
};

/** Options for the useNovelReader hook */
export interface UseNovelReaderOptions {
  /** Path to the local EPUB file */
  filePath: string;
}

/**
 * Hook containing the logic for the NovelReader component.
 * Handles loading EPUB files, setting up the view, applying themes, and handling navigation.
 *
 * @param options - Configuration options including the file path.
 * @returns An object containing the viewer reference.
 */
export const useNovelReader = ({ filePath }: UseNovelReaderOptions) => {
  const theme = useAppTheme();
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View | null>(null);
  const index = useAppSelector((state) => state.read.containerFile.index);
  const cfi = useAppSelector((state) => state.read.containerFile.cfi);
  const readingDirection = useAppSelector((state) => state.settings.reader.comic.readingDirection);
  const fontFamily = useAppSelector((state) => state.settings.reader.novel.fontFamily);
  const fontSize = useAppSelector((state) => state.settings.reader.novel.fontSize);
  const dispatch = useDispatch<AppDispatch>();

  const onMoveForward = useCallback(() => {
    viewRef.current?.next();
  }, []);

  const onMoveBack = useCallback(() => {
    viewRef.current?.prev();
  }, []);

  const applyThemeToView = useCallback(
    (view: View) => {
      const css = `
        @font-face {
          font-family: "BundledNotoSerifJP";
          src: url(${BundledNotoSerifJP}) format('woff2');
          font-weight: normal;
          font-style: normal;
        }
        * {
          font-family: "${fontFamily === "default-font" ? "BundledNotoSerifJP" : fontFamily}" !important;
        }
        body {
          font-family: "${fontFamily === "default-font" ? "BundledNotoSerifJP" : fontFamily}" !important;
          font-size: ${fontSize}px !important;
          color: ${theme.palette.text.primary} !important;
          user-select: none;
        }
        a { color: ${theme.palette.primary.main} !important; }
        .introduction { color: ${theme.palette.text.secondary} !important; }
        .postscript { color: ${theme.palette.text.secondary} !important; }
        ${
          navigator.userAgent.indexOf("Linux") !== -1
            ? `
          .vrtl { font-feature-settings: "vert"; }
          `
            : ""
        }
      `;
      if (view.renderer && view.renderer instanceof Paginator) {
        view.renderer.setStyles(css);
      }
    },
    [theme, fontFamily, fontSize],
  );

  const { handleClicked, handleContextMenu, handleWheeled, handleKeydown } = usePageNavigation(
    onMoveForward,
    onMoveBack,
    readingDirection,
  );

  // Use a ref to hold the latest callbacks and context to avoid re-triggering loadBook
  const contextRef = useRef({
    applyThemeToView,
    cfi,
    index,
    dispatch,
    handleClicked,
    handleContextMenu,
    handleWheeled,
    handleKeydown,
  });

  // Always keep the ref updated with the latest context values
  useEffect(() => {
    contextRef.current = {
      applyThemeToView,
      cfi,
      index,
      dispatch,
      handleClicked,
      handleContextMenu,
      handleWheeled,
      handleKeydown,
    };
  });

  useEffect(() => {
    let isMounted = true;

    const loadBook = async () => {
      if (!filePath || !viewerRef.current) {
        return;
      }

      // Cleanup previous book instance if it exists.
      viewRef.current?.close();
      viewRef.current?.remove();
      viewRef.current = null;

      const binaryData = await readFile(filePath);

      if (!isMounted) {
        return;
      }

      const file = new File([binaryData], filePath, { type: "application/epub+zip" });
      const book = await makeBook(file);

      if (!isMounted) {
        book.destroy?.();
        return;
      }

      if (book.sections) {
        const tocMap = buildTocMap(book);
        contextRef.current.dispatch(
          setEntries(
            book.sections.map((section, sectionIndex) => {
              return tocMap.get(sectionIndex) || section?.id || sectionIndex.toString();
            }),
          ),
        );
      }

      const view = document.createElement("foliate-view") as View;
      viewerRef.current.appendChild(view);
      viewRef.current = view;

      await view.open(book);

      if (!isMounted) {
        return;
      }

      contextRef.current.applyThemeToView(view);

      view.addEventListener("load", (e) => {
        const { doc } = e.detail;

        const isVertical = doc.defaultView
          ? doc.defaultView.getComputedStyle(doc.body).writingMode.includes("vertical")
          : false;

        if (view.renderer && view.renderer instanceof Paginator) {
          if (isVertical) {
            // Force the content to occupy the maximum available height of the container in vertical mode.
            view.renderer.setAttribute("max-inline-size", "10000px");
          } else {
            view.renderer.removeAttribute("max-inline-size");
          }
        }

        doc.addEventListener("click", (ev: MouseEvent) => {
          // Ignore click events on links.
          const target = ev.target as HTMLElement;
          if (target.closest("a")) {
            return;
          }
          contextRef.current.handleClicked(ev);
        });
        doc.addEventListener("contextmenu", (ev: MouseEvent) => {
          ev.preventDefault();
          contextRef.current.handleContextMenu(ev);
        });
        doc.addEventListener("wheel", (ev: WheelEvent) => {
          contextRef.current.handleWheeled(ev);
        });
        doc.addEventListener("keydown", (ev: KeyboardEvent) => {
          contextRef.current.handleKeydown(ev);
        });
      });

      if (isMounted) {
        await view.init({ lastLocation: contextRef.current.cfi ?? contextRef.current.index });

        view.addEventListener("relocate", (e) => {
          if (!isMounted) return;
          // foliate-js view's relocate event returns index in detail.section.current, or occasionally detail.index.
          const newIndex = e.detail.section?.current ?? e.detail.index ?? 0;
          const newCfi = e.detail.cfi ?? "";
          contextRef.current.dispatch(setNovelLocation({ index: newIndex, cfi: newCfi }));
        });
      }
    };

    loadBook().catch((ex) => {
      error(`Error loading EPUB file: ${ex}`);
    });

    return () => {
      isMounted = false;
      viewRef.current?.close();
      viewRef.current?.remove();
      viewRef.current = null;
    };
  }, [filePath]);

  useEffect(() => {
    if (viewRef.current) {
      applyThemeToView(viewRef.current);
    }
  }, [applyThemeToView]);

  useEffect(() => {
    if (!viewRef.current) {
      return;
    }

    const currentCfi = viewRef.current.lastLocation?.cfi;
    const currentIndex = viewRef.current.lastLocation?.index;

    if (cfi && cfi !== currentCfi) {
      viewRef.current.goTo(cfi).catch((e) => {
        error(`Failed to navigate to CFI(${cfi}): ${e}`);
      });
    } else if (index !== undefined && index !== currentIndex) {
      viewRef.current.goTo(index).catch((e) => {
        error(`Failed to navigate to index(${index}): ${e}`);
      });
    }
  }, [cfi, index]);

  useEffect(() => {
    // Note: handleKeydown needs to be wrapped or the dependency array updated,
    // but window.addEventListener uses the function directly.
    // If handleKeydown changes, the listener gets updated correctly.
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [handleKeydown]);

  return { viewerRef };
};
