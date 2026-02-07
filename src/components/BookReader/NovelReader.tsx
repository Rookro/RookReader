import { useCallback, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import ePub, { Book, Contents, Rendition, Location, NavItem } from "epubjs";
import { Badge, Box } from "@mui/material";
import { readFile } from "@tauri-apps/plugin-fs";
import { error } from "@tauri-apps/plugin-log";
import { useAppTheme } from "../../hooks/useAppTheme";
import { usePageNavigation } from "../../hooks/usePageNavigation";
import { AppDispatch, useAppSelector } from "../../Store";
import { setEntries, setNovelLocation } from "../../reducers/FileReducer";
import BundledNotoSerifJP from "../../assets/fonts/NotoSerifJP-VariableFont_wght.woff2";
import { settingsStore } from "../../settings/SettingsStore";
import { NovelReaderSettings } from "../../types/Settings";
import { setNovelFont, setNovelFontSize } from "../../reducers/ViewReducer";

/** Props for the NovelReader component */
interface NovelReaderProps {
  /** Path to the local EPUB file */
  filePath: string;
}

/**
 * Component for rendering Novel EPUB files.
 *
 * @beta
 *
 * @remarks
 * This component is currently in beta and may be subject to breaking changes
 * in future releases.
 */
export default function NovelReader({ filePath }: NovelReaderProps) {
  const theme = useAppTheme();
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const { index, cfi } = useAppSelector((state) => state.file.containerFile);
  const { direction, novel } = useAppSelector((state) => state.view);
  const dispatch = useDispatch<AppDispatch>();

  const initialized = useRef(false);

  const onMoveForward = useCallback(() => {
    renditionRef.current?.next();
  }, []);

  const onMoveBack = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

  const applyThemeToRendition = useCallback(
    (rendition: Rendition) => {
      rendition.themes.default({
        "@font-face": {
          "font-family": "BundledNotoSerifJP",
          src: `url(${BundledNotoSerifJP}) format('woff2')`,
          "font-weight": "normal",
          "font-style": "normal",
        },
        "*": {
          "font-family": `"${novel.font === "default-font" ? "BundledNotoSerifJP" : novel.font}" !important`,
        },
        body: {
          "font-family": `"${novel.font === "default-font" ? "BundledNotoSerifJP" : novel.font}" !important`,
          "font-size": `${novel.fontSize}px`,
          color: theme.palette.text.primary,
          background: theme.palette.background.default,
          "user-select": "none",
        },
        ".introduction": { color: `${theme.palette.text.secondary} !important` },
        ".postscript": { color: `${theme.palette.text.secondary} !important` },
      });
    },
    [theme, novel],
  );

  const { handleClicked, handleContextMenu, handleWheeled, handleKeydown } = usePageNavigation(
    onMoveForward,
    onMoveBack,
    direction,
  );

  useEffect(() => {
    let isMounted = true;

    const loadBook = async () => {
      if (!filePath || !viewerRef.current) {
        return;
      }

      // Cleanup previous book instance if it exists.
      renditionRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current?.destroy();
      bookRef.current = null;

      const binaryData = await readFile(filePath);

      if (!isMounted) {
        return;
      }

      const book = ePub(binaryData.buffer);
      bookRef.current = book;

      Promise.all([book.loaded.spine, book.loaded.navigation]).then(([spine, nav]) => {
        if (!isMounted) {
          return;
        }
        // 'spine' is actually a Spine object, not SpineItem[].
        // Access each item via the 'items' property.
        if ("items" in spine && Array.isArray(spine.items)) {
          const entries = spine.items.map((item) => {
            const navItem = !item.href ? undefined : findNavItemByHref(nav.toc, item.href);
            return navItem ? navItem.label : (item.idref ?? item.index.toString());
          });
          dispatch(setEntries(entries));
        }
      });

      const rendition = book.renderTo(viewerRef.current, {
        width: "100%",
        height: "100%",
        spread: "auto",
        allowScriptedContent: true,
      });
      renditionRef.current = rendition;

      applyThemeToRendition(rendition);

      rendition.hooks.content.register((contents: Contents) => {
        const doc = contents.document;

        doc.addEventListener("click", (e: MouseEvent) => {
          // Ignore click events on links.
          const target = e.target as HTMLElement;
          if (target.closest("a")) {
            return;
          }
          handleClicked(e);
        });
        doc.addEventListener("contextmenu", (e: MouseEvent) => {
          e.preventDefault();
          handleContextMenu(e);
        });
        doc.addEventListener("wheel", (e: WheelEvent) => {
          handleWheeled(e);
        });
        doc.addEventListener("keydown", (e: KeyboardEvent) => {
          handleKeydown(e);
        });
      });

      rendition.on("relocated", (location: Location) => {
        if (!isMounted) {
          return;
        }
        dispatch(setNovelLocation({ index: location.start.index, cfi: location.start.cfi }));
      });

      if (isMounted) {
        rendition.display(index);
      }

      // Initialize settings after epubjs is initialized.
      if (!initialized.current) {
        const settings = await settingsStore.get<NovelReaderSettings>("novel-reader");
        if (settings?.font) {
          dispatch(setNovelFont(settings.font));
        }
        if (settings?.fontSize) {
          dispatch(setNovelFontSize(settings.fontSize));
        }
        initialized.current = true;
      }
    };

    loadBook().catch((ex) => {
      error(`Error loading EPUB file: ${ex}`);
    });

    return () => {
      isMounted = false;
      renditionRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current?.destroy();
      bookRef.current = null;
    };

    // Do not re-render the rendition component if the theme is changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, handleClicked, handleContextMenu, handleWheeled, handleKeydown, dispatch]);

  useEffect(() => {
    const element = viewerRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      if (entries.length <= 0) {
        return;
      }

      const width = entries[0].contentBoxSize[0].inlineSize;
      const height = entries[0].contentBoxSize[0].blockSize;
      renditionRef.current?.resize(width, height);
    });
    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, []);

  useEffect(() => {
    if (renditionRef.current) {
      applyThemeToRendition(renditionRef.current);
    }
  }, [applyThemeToRendition]);

  useEffect(() => {
    if (cfi && cfi !== renditionRef.current?.location?.start.cfi) {
      renditionRef.current?.display(cfi);
    } else if (index && index !== renditionRef.current?.location?.start.index) {
      renditionRef.current?.display(index);
    }
  }, [cfi, index]);

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
      <Box component="div" ref={viewerRef} sx={{ width: "100%", height: "100%" }} />
    </Badge>
  );
}

/**
 * Recursively searches for an item with the specified href in the NavItem array.
 *
 * @param items - The array of NavItems to search.
 * @param targetHref - The href value to look for.
 * @returns The found NavItem, or undefined if not found.
 */
function findNavItemByHref(items: NavItem[], targetHref: string): NavItem | undefined {
  for (const item of items) {
    if (item.href === targetHref) {
      return item;
    }

    if (item.subitems && item.subitems.length > 0) {
      const found = findNavItemByHref(item.subitems, targetHref);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}
