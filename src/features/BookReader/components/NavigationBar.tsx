import ArrowBack from "@mui/icons-material/ArrowBack";
import ArrowForward from "@mui/icons-material/ArrowForward";
import Bookmark from "@mui/icons-material/Bookmark";
import BookmarkBorder from "@mui/icons-material/BookmarkBorder";
import LocalLibrary from "@mui/icons-material/LocalLibrary";
import LooksOne from "@mui/icons-material/LooksOne";
import LooksTwo from "@mui/icons-material/LooksTwo";
import Settings from "@mui/icons-material/Settings";
import SwitchLeft from "@mui/icons-material/SwitchLeft";
import SwitchRight from "@mui/icons-material/SwitchRight";
import ViewColumn from "@mui/icons-material/ViewColumn";
import { Box, IconButton, OutlinedInput, Toolbar, Tooltip } from "@mui/material";
import { debug } from "@tauri-apps/plugin-log";
import type React from "react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../store/store";
import type { Direction } from "../../../types/AppSettings";
import { openSettingsWindow } from "../../../utils/WindowOpener";
import { setActiveView } from "../../MainView/slice";
import { updateSettings } from "../../Settings/slice";
import { addBookmark, removeBookmark } from "../bookmarkSlice";
import {
  goBackContainerHistory,
  goForwardContainerHistory,
  setContainerFilePath,
  setSpreadShifted,
} from "../slice";

/**
 * Navigation bar component.
 */
export default function NavigationBar() {
  const { t } = useTranslation();
  const readerSettings = useAppSelector((state) => state.settings.reader);
  const history = useAppSelector((state) => state.read.containerFile.history);
  const historyIndex = useAppSelector((state) => state.read.containerFile.historyIndex);
  const book = useAppSelector((state) => state.read.containerFile.book);
  const index = useAppSelector((state) => state.read.containerFile.index);
  const cfi = useAppSelector((state) => state.read.containerFile.cfi);
  const isNovel = useAppSelector((state) => state.read.containerFile.isNovel);
  const entries = useAppSelector((state) => state.read.containerFile.entries);
  const isSpreadShifted = useAppSelector((state) => state.read.containerFile.isSpreadShifted);
  const bookmarks = useAppSelector((state) => state.bookmark.bookmarks);
  const dispatch = useAppDispatch();

  const currentPath = history[historyIndex] ?? "";

  // A novel position is identified by its CFI, a comic position by its page index.
  const currentBookmark = useMemo(
    () =>
      bookmarks.find((bookmark) =>
        isNovel
          ? cfi !== null && bookmark.cfi === cfi
          : bookmark.cfi === null && bookmark.page_index === index,
      ),
    [bookmarks, isNovel, cfi, index],
  );

  const formAction = useCallback(
    (formData: FormData) => {
      const inputPath = formData.get("path")?.toString();

      if (inputPath && inputPath !== currentPath) {
        dispatch(setContainerFilePath(inputPath));
      }
    },
    [dispatch, currentPath],
  );

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.form?.requestSubmit();
  }, []);

  const handleSwitchTwoPagedClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(
        updateSettings({
          key: "reader",
          value: { comic: { enableSpread: !readerSettings.comic.enableSpread } },
        }),
      );
    },
    [dispatch, readerSettings.comic.enableSpread],
  );

  const handleShiftSpreadClicked = useCallback(() => {
    dispatch(setSpreadShifted(!isSpreadShifted));
  }, [dispatch, isSpreadShifted]);

  const handleSwitchDirectionClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      const newDirection: Direction =
        readerSettings.comic.readingDirection === "rtl" ? "ltr" : "rtl";
      dispatch(
        updateSettings({ key: "reader", value: { comic: { readingDirection: newDirection } } }),
      );
    },
    [dispatch, readerSettings.comic.readingDirection],
  );

  const handleLibraryClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(setActiveView("bookshelf"));
    },
    [dispatch],
  );

  const handleBackClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(goBackContainerHistory());
    },
    [dispatch],
  );

  const handleForwardClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      dispatch(goForwardContainerHistory());
    },
    [dispatch],
  );

  const handleToggleBookmarkClicked = useCallback(
    (_e: React.MouseEvent<HTMLButtonElement>) => {
      if (!book) {
        return;
      }
      if (currentBookmark) {
        dispatch(removeBookmark(currentBookmark.id));
        return;
      }
      // Name the bookmark after the novel's section label when there is one, so the
      // list reads as a table of contents; otherwise fall back to the page number.
      const pageName = t("book-reader.bookmark.default-page-name", { page: index + 1 });
      const name = isNovel ? (entries[index] ?? pageName) : pageName;
      dispatch(
        addBookmark({
          bookId: book.id,
          name,
          pageIndex: index,
          cfi: isNovel ? (cfi ?? null) : null,
        }),
      );
    },
    [dispatch, book, currentBookmark, isNovel, entries, index, cfi, t],
  );

  const handleSettingsClicked = useCallback(async (_e: React.MouseEvent<HTMLButtonElement>) => {
    debug("handleSettingsClicked");
    openSettingsWindow();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <Toolbar variant="dense" disableGutters sx={{ minHeight: "40px" }}>
      <Tooltip title={t("book-reader.move-to-bookshelf")}>
        <IconButton onClick={handleLibraryClicked} aria-label="library">
          <LocalLibrary />
        </IconButton>
      </Tooltip>
      <Tooltip title={t("common.back")}>
        <span>
          <IconButton onClick={handleBackClicked} disabled={historyIndex <= 0} aria-label="back">
            <ArrowBack />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t("common.forward")}>
        <span>
          <IconButton
            onClick={handleForwardClicked}
            disabled={history.length - historyIndex <= 1}
            aria-label="forward"
          >
            <ArrowForward />
          </IconButton>
        </span>
      </Tooltip>
      <Box component="form" action={formAction} sx={{ flexGrow: 1 }}>
        <OutlinedInput
          // Force DOM recreation to update the initial value on external state changes.
          key={currentPath}
          name="path"
          defaultValue={currentPath}
          onContextMenu={handleContextMenu}
          onBlur={handleBlur}
          size="small"
          fullWidth
          inputProps={{ "aria-label": "container-path-input" }}
          sx={{
            bgcolor: (theme) => theme.palette.background.default,
            "& .MuiOutlinedInput-input": {
              padding: "4px 8px",
            },
          }}
        />
      </Box>
      <Tooltip
        title={currentBookmark ? t("book-reader.remove-bookmark") : t("book-reader.add-bookmark")}
      >
        <span>
          <IconButton
            onClick={handleToggleBookmarkClicked}
            disabled={!book}
            aria-label="toggle-bookmark"
          >
            {currentBookmark ? <Bookmark /> : <BookmarkBorder />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t("book-reader.toggle-spread")}>
        <IconButton onClick={handleSwitchTwoPagedClicked} aria-label="toggle-two-paged">
          {readerSettings.comic.enableSpread ? <LooksTwo /> : <LooksOne />}
        </IconButton>
      </Tooltip>
      <Tooltip
        title={isSpreadShifted ? t("book-reader.reset-spread") : t("book-reader.shift-spread")}
      >
        <span>
          <IconButton
            onClick={handleShiftSpreadClicked}
            disabled={!readerSettings.comic.enableSpread}
            color={isSpreadShifted ? "primary" : "default"}
            aria-label="shift-spread"
          >
            <ViewColumn />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t("book-reader.toggle-direction")}>
        <IconButton onClick={handleSwitchDirectionClicked} aria-label="toggle-direction">
          {readerSettings.comic.readingDirection === "rtl" ? <SwitchRight /> : <SwitchLeft />}
        </IconButton>
      </Tooltip>
      <Tooltip title={t("common.settings")}>
        <IconButton onClick={handleSettingsClicked} aria-label="settings">
          <Settings />
        </IconButton>
      </Tooltip>
    </Toolbar>
  );
}
