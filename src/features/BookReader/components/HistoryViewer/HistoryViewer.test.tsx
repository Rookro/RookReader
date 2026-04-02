import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import HistoryViewer from "./HistoryViewer";
import * as ReadReducer from "../../slice";
import { createMockReadBook } from "../../../../test/factories";
import { error } from "@tauri-apps/plugin-log";
import { useHistorySelection } from "../../hooks/useHistorySelection";
import { mockScrollToRow } from "../../../../test/mocks/components";

// Mock hooks
vi.mock("../../../History/hooks/useHistoryEntriesUpdater", () => ({
  useHistoryEntriesUpdater: vi.fn(),
}));
vi.mock("../../hooks/useHistorySelection", () => ({
  useHistorySelection: vi.fn(),
}));

// Mock SidePanelHeader
vi.mock("../../../SidePane/components/SidePanelHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="side-panel-header">{title}</div>,
}));

// Mock actions
vi.mock("../../slice", async () => {
  const actual = await vi.importActual("../../slice");
  return {
    ...actual,
    setContainerFilePath: vi.fn((payload: string) => ({
      type: "read/setContainerFilePath",
      payload,
    })),
  };
});

describe("HistoryViewer", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render SidePanelHeader and Search input", () => {
    renderWithProviders(<HistoryViewer />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByTestId("side-panel-header")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("should show 'no history' message when recentlyReadBooks is empty", () => {
    renderWithProviders(<HistoryViewer />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByText("No history.")).toBeInTheDocument();
  });

  it("should render list items when history entries are present", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockReadBook({ id: 1, file_path: "/path/1", display_name: "Book 1" }),
      createMockReadBook({ id: 2, file_path: "/path/2", display_name: "Book 2" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });
    expect(screen.getByText("Book 1")).toBeInTheDocument();
    expect(screen.getByText("Book 2")).toBeInTheDocument();
  });

  it("should dispatch setContainerFilePath when an item is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockReadBook({ id: 1, file_path: "/path/1", display_name: "Book 1" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const rowButton = screen.getByRole("button", { name: /Book 1/i });
    await user.click(rowButton);

    expect(ReadReducer.setContainerFilePath).toHaveBeenCalledWith("/path/1");
  });

  it("should filter results based on search input", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockReadBook({ id: 1, file_path: "/path/1", display_name: "Apple" }),
      createMockReadBook({ id: 2, file_path: "/path/2", display_name: "Banana" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const searchInput = screen.getByRole("searchbox");
    await user.type(searchInput, "Apple");

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
  });

  it("should show 'no search results' when search does not match any entry", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockReadBook({ id: 1, file_path: "/path/1", display_name: "Apple" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const searchInput = screen.getByRole("searchbox");
    await user.type(searchInput, "Banana");

    expect(screen.getByText(/No results for "Banana"/i)).toBeInTheDocument();
  });

  it("should scroll to row when selectedIndex is set", async () => {
    vi.mocked(useHistorySelection).mockImplementationOnce((_path, _entries, callback) => {
      callback(1);
    });

    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockReadBook({ file_path: "/path/1", display_name: "B1" }),
      createMockReadBook({ file_path: "/path/2", display_name: "B2" }),
    ];
    preloadedState.read.containerFile.history = ["/path/2"];
    preloadedState.read.containerFile.historyIndex = 0;

    renderWithProviders(<HistoryViewer />, { preloadedState });

    await waitFor(() => {
      expect(mockScrollToRow).toHaveBeenCalledWith({
        align: "smart",
        behavior: "instant",
        index: 1,
      });
    });
  });

  it("should log error if scrollToRow fails", async () => {
    vi.mocked(useHistorySelection).mockImplementationOnce((_path, _entries, callback) => {
      callback(0);
    });

    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [createMockReadBook({ file_path: "/path/2" })];
    preloadedState.read.containerFile.history = ["/path/2"];
    preloadedState.read.containerFile.historyIndex = 0;

    mockScrollToRow.mockImplementationOnce(() => {
      throw new Error("Scroll error");
    });

    renderWithProviders(<HistoryViewer />, { preloadedState });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });
  });

  it("should prevent context menu propagation", async () => {
    renderWithProviders(<HistoryViewer />, { preloadedState: createBasePreloadedState() });
    const searchInput = screen.getByRole("searchbox");

    const event = fireEvent.contextMenu(searchInput);
    expect(event).toBe(true);
  });
});
