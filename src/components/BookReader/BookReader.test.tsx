import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import { renderWithProviders, createBasePreloadedState } from "../../test/utils";
import BookReader from "./BookReader";
import * as bookCmds from "../../bindings/BookCommands";
import * as containerCmds from "../../bindings/ContainerCommands";
import * as dragDrop from "../../hooks/useDragDropEvent";
import * as readRed from "../../reducers/ReadReducer";
import { error } from "@tauri-apps/plugin-log";

// Module-level mocks to bypass lazy loading
vi.mock("../SidePane/SideTabs", () => ({ default: () => <div data-testid="side-tabs" /> }));
vi.mock("../SidePane/SidePanels", () => ({ default: () => <div data-testid="side-panels" /> }));
vi.mock("./ControlSlider", () => ({ default: () => <div data-testid="control-slider" /> }));
vi.mock("./NavigationBar", () => ({ default: () => <div data-testid="navigation-bar" /> }));
vi.mock("./FileNavigator/FileNavigator", () => ({ default: () => <div /> }));
vi.mock("./ImageEntriesViewer/ImageEntriesViewer", () => ({ default: () => <div /> }));
vi.mock("./HistoryViewer/HistoryViewer", () => ({ default: () => <div /> }));
vi.mock("./ComicReader", () => ({ default: () => <div data-testid="comic-reader" /> }));
vi.mock("./NovelReader", () => ({ default: () => <div data-testid="novel-reader" /> }));

vi.mock("../../hooks/useDragDropEvent", () => ({
  useDragDropEvent: vi.fn(),
}));

vi.mock("../../reducers/ReadReducer", async () => {
  const actual = await vi.importActual("../../reducers/ReadReducer");
  return {
    ...actual,
    openContainerFile: vi.fn(() => ({ type: "read/openContainerFile" })),
    setContainerFilePath: vi.fn((p: string) => ({ type: "read/setContainerFilePath", payload: p })),
  };
});

vi.mock("../../bindings/ContainerCommands", async () => {
  const actual = await vi.importActual("../../bindings/ContainerCommands");
  return {
    ...actual,
    setPdfRenderingHeight: vi.fn(() => Promise.resolve()),
  };
});

describe("BookReader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should render main sub-components", async () => {
    renderWithProviders(<BookReader />, { preloadedState: createBasePreloadedState() });
    await waitFor(() => expect(screen.getByTestId("navigation-bar")).toBeInTheDocument());
    expect(screen.getByTestId("control-slider")).toBeInTheDocument();
    await waitFor(() => {
      expect(containerCmds.setPdfRenderingHeight).toHaveBeenCalledWith(2000);
    });
  });

  it("should restore last container on startup if enabled", async () => {
    const state = createBasePreloadedState();
    state.settings.history["restore-last-container-on-startup"] = true;

    vi.mocked(bookCmds.getRecentlyReadBooks).mockResolvedValue([
      {
        id: 1,
        file_path: "/last/book.zip",
        display_name: "Last Book",
        total_pages: 100,
        item_type: "file",
        last_read_page_index: 0,
        series_id: null,
        series_order: null,
        thumbnail_path: null,
        last_opened_at: "",
      },
    ]);

    renderWithProviders(<BookReader />, { preloadedState: state });
    await waitFor(() =>
      expect(readRed.setContainerFilePath).toHaveBeenCalledWith("/last/book.zip"),
    );
  });

  it("should handle empty history during startup restoration", async () => {
    const state = createBasePreloadedState();
    state.settings.history["restore-last-container-on-startup"] = true;

    vi.mocked(bookCmds.getRecentlyReadBooks).mockResolvedValue([]);

    renderWithProviders(<BookReader />, { preloadedState: state });
    await waitFor(() => expect(bookCmds.getRecentlyReadBooks).toHaveBeenCalled());
    expect(readRed.setContainerFilePath).not.toHaveBeenCalled();
  });

  it("should update container when a file is dropped", async () => {
    renderWithProviders(<BookReader />, { preloadedState: createBasePreloadedState() });

    await waitFor(() => expect(dragDrop.useDragDropEvent).toHaveBeenCalled());
    const dropHandler = (
      vi.mocked(dragDrop.useDragDropEvent).mock.calls[0][0] as { onDrop: (paths: string[]) => void }
    ).onDrop;

    act(() => {
      dropHandler?.(["/dropped/file.zip"]);
    });
    await waitFor(() => {
      expect(readRed.setContainerFilePath).toHaveBeenCalledWith("/dropped/file.zip");
    });
  });

  it("should save pane sizes to localStorage on change", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    renderWithProviders(<BookReader />, { preloadedState: createBasePreloadedState() });

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith(
        "book-reader-left-pane-sizes",
        JSON.stringify([100, 900]),
      );
    });
  });

  it("should handle malformed localStorage data", () => {
    localStorage.setItem("book-reader-left-pane-sizes", "invalid-json");
    renderWithProviders(<BookReader />, { preloadedState: createBasePreloadedState() });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse book-reader-left-pane-sizes"),
    );
  });

  it("should ignore non-array or non-number array in localStorage", () => {
    localStorage.setItem("book-reader-left-pane-sizes", JSON.stringify({ not: "array" }));
    renderWithProviders(<BookReader />, { preloadedState: createBasePreloadedState() });

    localStorage.setItem("book-reader-left-pane-sizes", JSON.stringify(["not", "numbers"]));
    renderWithProviders(<BookReader />, { preloadedState: createBasePreloadedState() });
  });
});
