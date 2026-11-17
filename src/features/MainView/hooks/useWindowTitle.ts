import { getCurrentWindow } from "@tauri-apps/api/window";
import { error } from "@tauri-apps/plugin-log";
import { useEffect } from "react";
import { useAppSelector } from "../../../store/store";
import { bookTitleFromPath } from "../../../utils/ArchivePathUtils";

const APP_NAME = "RookReader";

/**
 * Keeps the window title on the open book: `<book name> - RookReader`, or `RookReader`
 * while no book is open.
 */
export function useWindowTitle() {
  const path = useAppSelector((state) => state.reader.history[state.reader.historyIndex]);

  useEffect(() => {
    const title = path ? `${bookTitleFromPath(path)} - ${APP_NAME}` : APP_NAME;
    getCurrentWindow()
      .setTitle(title)
      .catch((e) => {
        error(`Failed to set the window title: ${String(e)}`);
      });
  }, [path]);
}
