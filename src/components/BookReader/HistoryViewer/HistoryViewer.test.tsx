import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, RootState } from "../../../test/utils";
import HistoryViewer from "./HistoryViewer";
import * as ReadReducer from "../../../reducers/ReadReducer";
import { createMockReadBook } from "../../../test/factories";
import { error } from "@tauri-apps/plugin-log";
import { useHistorySelection } from "../../../hooks/useHistorySelection";
import { mockScrollToRow } from "../../../test/mocks/components";

// Mock hooks
vi.mock("../../../hooks/useHistoryEntriesUpdater", () => ({ useHistoryEntriesUpdater: vi.fn() }));
vi.mock("../../../hooks/useHistorySelection", () => ({
  useHistorySelection: vi.fn(),
}));

// Mock SidePanelHeader
vi.mock("../../SidePane/SidePanelHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="side-panel-header">{title}</div>,
}));

// Mock actions
vi.mock("../../../reducers/ReadReducer", async () => {
  const actual = (await vi.importActual("../../../reducers/ReadReducer")) as Record<
    string,
    unknown
  >;
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

  const defaultPreloadedState = {
    history: {
      recentlyReadBooks: [],
      status: "idle",
      error: null,
    },
    read: {
      containerFile: {
        history: [],
        historyIndex: -1,
        isDirectory: false,
        entries: [],
        book: null,
        index: 0,
        cfi: null,
        isNovel: false,
        isLoading: false,
        error: null,
      },
    },
  } as unknown as RootState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render SidePanelHeader and Search input", () => {
    renderWithProviders(<HistoryViewer />, { preloadedState: defaultPreloadedState });
    expect(screen.getByTestId("side-panel-header")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("should show 'no history' message when recentlyReadBooks is empty", () => {
    renderWithProviders(<HistoryViewer />, { preloadedState: defaultPreloadedState });
    expect(screen.getByText("No history.")).toBeInTheDocument();
  });

  it("should render list items when history entries are present", () => {
    const preloadedState = {
      ...defaultPreloadedState,
      history: {
        recentlyReadBooks: [
          createMockReadBook({ id: 1, file_path: "/path/1", display_name: "Book 1" }),
          createMockReadBook({ id: 2, file_path: "/path/2", display_name: "Book 2" }),
        ],
      },
    } as unknown as RootState;

    renderWithProviders(<HistoryViewer />, { preloadedState });
    expect(screen.getByText("Book 1")).toBeInTheDocument();
    expect(screen.getByText("Book 2")).toBeInTheDocument();
  });

  it("should dispatch setContainerFilePath when an item is clicked", async () => {
    const preloadedState = {
      ...defaultPreloadedState,
      history: {
        recentlyReadBooks: [
          createMockReadBook({ id: 1, file_path: "/path/1", display_name: "Book 1" }),
        ],
      },
    } as unknown as RootState;

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const rowButton = screen.getByRole("button", { name: /Book 1/i });
    await user.click(rowButton);

    expect(ReadReducer.setContainerFilePath).toHaveBeenCalledWith("/path/1");
  });

  it("should filter results based on search input", async () => {
    const preloadedState = {
      ...defaultPreloadedState,
      history: {
        recentlyReadBooks: [
          createMockReadBook({ id: 1, file_path: "/path/1", display_name: "Apple" }),
          createMockReadBook({ id: 2, file_path: "/path/2", display_name: "Banana" }),
        ],
      },
    } as unknown as RootState;

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const searchInput = screen.getByRole("searchbox");
    await user.type(searchInput, "Apple");

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
  });

  it("should show 'no search results' when search does not match any entry", async () => {
    const preloadedState = {
      ...defaultPreloadedState,
      history: {
        recentlyReadBooks: [createMockReadBook({ display_name: "Apple" })],
      },
    } as unknown as RootState;

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const searchInput = screen.getByRole("searchbox");
    await user.type(searchInput, "Banana");

    expect(screen.getByText(/No results for "Banana"/i)).toBeInTheDocument();
  });

  it("should scroll to row when selectedIndex is set", async () => {
    vi.mocked(useHistorySelection).mockImplementationOnce((_path, _entries, callback) => {
      callback(1);
    });

    const preloadedState = {
      ...defaultPreloadedState,
      history: {
        recentlyReadBooks: [
          createMockReadBook({ file_path: "/path/1", display_name: "B1" }),
          createMockReadBook({ file_path: "/path/2", display_name: "B2" }),
        ],
      },
      read: {
        containerFile: {
          history: ["/path/2"],
          historyIndex: 0,
        },
      },
    } as unknown as RootState;

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

    const preloadedState = {
      ...defaultPreloadedState,
      history: {
        recentlyReadBooks: [createMockReadBook({ file_path: "/path/2" })],
      },
      read: {
        containerFile: {
          history: ["/path/2"],
          historyIndex: 0,
        },
      },
    } as unknown as RootState;

    mockScrollToRow.mockImplementationOnce(() => {
      throw new Error("Scroll error");
    });

    renderWithProviders(<HistoryViewer />, { preloadedState });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });
  });

  it("should prevent context menu propagation", async () => {
    renderWithProviders(<HistoryViewer />, { preloadedState: defaultPreloadedState });
    const searchInput = screen.getByRole("searchbox");

    const event = fireEvent.contextMenu(searchInput);
    expect(event).toBe(true);
  });
});
