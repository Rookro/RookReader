import { readFile } from "@tauri-apps/plugin-fs";
import { debug, error } from "@tauri-apps/plugin-log";
import "foliate-js/view.js";
import type { RelocateEventDetail, TOCItem, View } from "foliate-js/view.js";
import { useCallback, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import BundledNotoSerifJP from "../../../assets/fonts/NotoSerifJP-VariableFont_wght.woff2";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { type AppDispatch, useAppSelector } from "../../../store/store";
import { setEntries, setNovelLocation } from "../slice";
import { usePageNavigation } from "./usePageNavigation";

/**
 * Custom hook for handling novel reader logic using foliate-js.
 *
 * @param filePath Path to the local EPUB file.
 * @returns Object containing the ref for the foliate-view element.
 */
export const useNovelReader = (filePath: string) => {
  const theme = useAppTheme();
  const dispatch = useDispatch<AppDispatch>();
  const viewRef = useRef<View | null>(null);
  const docsRef = useRef<Set<Document>>(new Set());
  const isInitialiingRef = useRef(true);

  const { index, cfi } = useAppSelector((state) => state.read.containerFile);
  const {
    comic: { readingDirection },
    novel: { fontFamily, fontSize },
  } = useAppSelector((state) => state.settings.reader);

  /** Applies the current theme and font settings to a specific document */
  const updateThemeForDoc = useCallback(
    (doc: Document) => {
      let style = doc.getElementById("novel-reader-theme") as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement("style");
        style.id = "novel-reader-theme";
        doc.head.appendChild(style);
      }
      style.textContent = `
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
        font-size: ${fontSize}px;
        color: ${theme.palette.text.primary};
        background: transparent;
        user-select: none;
      }
      .introduction { color: ${theme.palette.text.secondary} !important; }
      .postscript { color: ${theme.palette.text.secondary} !important; }
      ${
        navigator.userAgent.indexOf("Linux") !== -1
          ? `.vrtl { font-feature-settings: "vert"; }`
          : ""
      }
    `;
    },
    [theme, fontFamily, fontSize],
  );

  const onMoveForward = useCallback(() => {
    viewRef.current?.next();
  }, []);

  const onMoveBack = useCallback(() => {
    viewRef.current?.prev();
  }, []);

  const { handleClicked, handleContextMenu, handleWheeled, handleKeydown } = usePageNavigation(
    onMoveForward,
    onMoveBack,
    readingDirection,
  );

  const handleLoad = useCallback(
    (e: Event) => {
      const customEvent = e as CustomEvent<{ doc: Document; index: number }>;
      const doc = customEvent.detail.doc;
      docsRef.current.add(doc);
      updateThemeForDoc(doc);

      doc.addEventListener("click", (ev) => {
        if (!(ev.target as HTMLElement).closest("a")) handleClicked(ev);
      });
      doc.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        handleContextMenu(ev);
      });
      doc.addEventListener("wheel", handleWheeled);
      doc.addEventListener("keydown", handleKeydown);

      if (navigator.userAgent.indexOf("Linux") !== -1) {
        const isVertical =
          doc.defaultView?.getComputedStyle(doc.body).writingMode.indexOf("vertical") !== -1;
        if (isVertical) {
          let style = doc.getElementById("vertical-writing-fix");
          if (!style) {
            style = doc.createElement("style");
            style.id = "vertical-writing-fix";
            doc.head.appendChild(style);
          }
          style.textContent = 'body { font-feature-settings: "vert"; }';
          debug("Applied 'vert' font feature settings.");
        }
      }
    },
    [updateThemeForDoc, handleClicked, handleContextMenu, handleWheeled, handleKeydown],
  );

  const handleRelocate = useCallback(
    (e: Event) => {
      const { cfi: newCfi, section } = (e as CustomEvent<RelocateEventDetail>).detail;
      dispatch(setNovelLocation({ index: section?.current ?? 0, cfi: newCfi ?? "" }));
    },
    [dispatch],
  );

  // Initialize and load the book
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run on mount and filePath change
  useEffect(() => {
    let isMounted = true;
    const view = viewRef.current;
    if (!view || !filePath) return;

    const loadBook = async () => {
      docsRef.current.clear();
      const binaryData = await readFile(filePath);
      if (!isMounted) return;

      const file = new File([binaryData.buffer], "book.epub", {
        type: "application/epub+zip",
      });

      await view.open(file);
      if (!isMounted) return;

      const book = view.book;
      if (book?.sections) {
        const findTocLabel = (
          href: string | undefined,
          items: TOCItem[] | undefined,
        ): string | undefined => {
          if (!href || !items) return undefined;
          for (const item of items) {
            const itemHrefBase = item.href.split("#")[0];
            if (itemHrefBase === href) return item.label || itemHrefBase;
            if (item.subitems) {
              const found = findTocLabel(href, item.subitems);
              if (found) return found;
            }
          }
          return undefined;
        };

        const entries = book.sections.map((sec, i) => {
          const label = findTocLabel(sec.id, book.toc);
          return label ?? sec.id ?? i.toString();
        });
        dispatch(setEntries(entries));
      }

      if (isMounted) {
        if (cfi) view.goTo(cfi).catch(() => {});
        else if (index != null) view.goTo(index).catch(() => {});
      }
    };

    isInitialiingRef.current = true;
    loadBook()
      .catch((ex) => error(`Error loading EPUB file: ${ex}`))
      .finally(() => {
        isInitialiingRef.current = false;
      });

    return () => {
      isMounted = false;
    };
  }, [filePath, dispatch]);

  const view = viewRef.current;
  useEffect(() => {
    if (!view) return;

    view.addEventListener("load", handleLoad);
    view.addEventListener("relocate", handleRelocate);

    return () => {
      view.removeEventListener("load", handleLoad);
      view.removeEventListener("relocate", handleRelocate);
    };
  }, [handleLoad, handleRelocate, view]);

  // Update themes when settings change
  useEffect(() => {
    docsRef.current.forEach((doc) => {
      if (doc.defaultView) updateThemeForDoc(doc);
      else docsRef.current.delete(doc);
    });
  }, [updateThemeForDoc]);

  const isInitializing = isInitialiingRef.current;
  // Synchronize location from store
  useEffect(() => {
    if (isInitializing) return;
    const lastLoc = viewRef.current?.lastLocation;
    if (cfi && cfi !== lastLoc?.cfi) {
      viewRef.current?.goTo(cfi).catch(() => {});
    } else if (index && index !== lastLoc?.section?.current) {
      viewRef?.current?.goTo(index).catch(() => {});
    }
  }, [cfi, index, isInitializing]);

  // Global keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleKeydown]);

  return { viewRef };
};
