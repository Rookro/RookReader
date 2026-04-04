import { Badge, Box } from "@mui/material";
import { readFile } from "@tauri-apps/plugin-fs";
import { debug, error } from "@tauri-apps/plugin-log";
import "foliate-js/view.js";
import type { Book, TOCItem, View } from "foliate-js/view.js";
import React, { useCallback, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import BundledNotoSerifJP from "../../../assets/fonts/NotoSerifJP-VariableFont_wght.woff2";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { type AppDispatch, useAppSelector } from "../../../store/store";
import { usePageNavigation } from "../hooks/usePageNavigation";
import { setEntries, setNovelLocation } from "../slice";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "foliate-view": import("react").DetailedHTMLProps<
        import("react").HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        class?: string;
        ref?: import("react").RefObject<import("foliate-js/view.js").View | null>;
      };
    }
  }
}

/** Props for the NovelReader component */
interface NovelReaderProps {
  /** Path to the local EPUB file */
  filePath: string;
}

/**
 * Component for rendering Novel EPUB files using foliate-js.
 *
 * @beta
 *
 * @remarks
 * This component is currently in beta and may be subject to breaking changes
 * in future releases.
 */
export default function NovelReader({ filePath }: NovelReaderProps) {
  const theme = useAppTheme();
  const viewRef = useRef<View | null>(null);
  const docsRef = useRef<Set<Document>>(new Set());
  const { index, cfi } = useAppSelector((state) => state.read.containerFile);
  const {
    comic: { readingDirection },
    novel: { fontFamily, fontSize },
  } = useAppSelector((state) => state.settings.reader);
  const dispatch = useDispatch<AppDispatch>();

  const onMoveForward = useCallback(() => {
    if (viewRef.current?.renderer) {
      viewRef.current.renderer.next();
    }
  }, []);

  const onMoveBack = useCallback(() => {
    if (viewRef.current?.renderer) {
      viewRef.current.renderer.prev();
    }
  }, []);

  const updateThemeForDoc = useCallback(
    (doc: Document) => {
      let style = doc.getElementById("novel-reader-theme");
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
          padding-left: 80px !important;
          padding-right: 80px !important;
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

  const { handleClicked, handleContextMenu, handleWheeled, handleKeydown } = usePageNavigation(
    onMoveForward,
    onMoveBack,
    readingDirection,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: We only want to use initial cfi and index on first load
  useEffect(() => {
    let isMounted = true;

    const loadBook = async () => {
      if (!filePath || !viewRef.current) {
        return;
      }

      docsRef.current.clear();
      const binaryData = await readFile(filePath);

      if (!isMounted) {
        return;
      }

      const file = new File([binaryData.buffer], "book.epub", {
        type: "application/epub+zip",
      });

      await viewRef.current.open(file);

      if (!isMounted) {
        return;
      }

      const book = (viewRef.current as unknown as { book?: Book })?.book;
      if (book?.sections) {
        const findTocLabel = (
          href: string | undefined,
          items: TOCItem[] | undefined,
        ): string | undefined => {
          if (!href || !items) return undefined;
          for (const item of items) {
            const itemHrefBase = item.href.split("#")[0];
            if (itemHrefBase === href) {
              return item.label || itemHrefBase;
            }
            if (item.subitems && item.subitems.length > 0) {
              const found = findTocLabel(href, item.subitems);
              if (found) return found;
            }
          }
          return undefined;
        };

        const entries = book.sections.map((sec, i) => {
          const secId = sec.id as string | undefined;
          const label = findTocLabel(secId, book.toc);
          return label ?? secId ?? i.toString();
        });
        dispatch(setEntries(entries));
      }

      if (isMounted) {
        if (cfi) {
          viewRef.current.goTo(cfi).catch(() => {});
        } else if (index != null) {
          viewRef.current.goTo(index).catch(() => {});
        }
      }
    };

    loadBook().catch((ex) => {
      error(`Error loading EPUB file: ${ex}`);
    });

    return () => {
      isMounted = false;
    };
  }, [filePath, dispatch]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const handleLoad = (e: Event) => {
      const customEvent = e as CustomEvent<{ doc: Document; index: number }>;
      const doc = customEvent.detail.doc;
      docsRef.current.add(doc);

      updateThemeForDoc(doc);

      doc.addEventListener("click", (ev: MouseEvent) => {
        const target = ev.target as HTMLElement;
        if (target.closest("a")) {
          return;
        }
        handleClicked(ev);
      });
      doc.addEventListener("contextmenu", (ev: MouseEvent) => {
        ev.preventDefault();
        handleContextMenu(ev);
      });
      doc.addEventListener("wheel", (ev: WheelEvent) => {
        handleWheeled(ev);
      });
      doc.addEventListener("keydown", (ev: KeyboardEvent) => {
        handleKeydown(ev);
      });

      const isLinux = navigator.userAgent.indexOf("Linux") !== -1;
      if (isLinux) {
        const isVertical =
          doc.defaultView?.getComputedStyle(doc.body).writingMode.indexOf("vertical") !== -1;
        if (isVertical) {
          let style = doc.getElementById("vertical-writing-fix");
          if (!style) {
            style = doc.createElement("style");
            style.id = "vertical-writing-fix";
            doc.head.appendChild(style);
          }
          style.textContent = `body { font-feature-settings: "vert"; }`;
          debug("Applied 'vert' font feature settings.");
        }
      }
    };

    const handleRelocate = (e: Event) => {
      const customEvent = e as CustomEvent<
        import("foliate-js/view.js").RelocateEventDetail & { index?: number }
      >;
      const { cfi: newCfi, index: newIndex, section } = customEvent.detail;
      dispatch(setNovelLocation({ index: section?.current ?? newIndex ?? 0, cfi: newCfi ?? "" }));
    };

    view.addEventListener("load", handleLoad);
    view.addEventListener("relocate", handleRelocate);

    return () => {
      view.removeEventListener("load", handleLoad);
      view.removeEventListener("relocate", handleRelocate);
    };
  }, [updateThemeForDoc, handleClicked, handleContextMenu, handleWheeled, handleKeydown, dispatch]);

  useEffect(() => {
    docsRef.current.forEach((doc) => {
      if (doc.defaultView) {
        updateThemeForDoc(doc);
      } else {
        docsRef.current.delete(doc);
      }
    });
  }, [updateThemeForDoc]);

  useEffect(() => {
    const lastLoc = viewRef.current?.lastLocation;
    if (cfi && cfi !== lastLoc?.cfi) {
      viewRef.current?.goTo(cfi).catch(() => {});
    } else if (index != null && index !== lastLoc?.section?.current) {
      viewRef.current?.goTo(index).catch(() => {});
    }
  }, [cfi, index]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [handleKeydown]);

  return (
    <Badge
      badgeContent="Beta"
      color="primary"
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      sx={{
        width: "100%",
        height: "100%",
        "& .MuiBadge-badge": {
          bottom: 12,
          right: 20,
        },
      }}
    >
      <Box sx={{ width: "100%", height: "100%", overflow: "hidden" }}>
        {React.createElement("foliate-view" as string, {
          ref: viewRef,
          style: {
            width: "100%",
            height: "100%",
            display: "block",
            background: theme.palette.background.default,
          },
        })}
      </Box>
    </Badge>
  );
}
