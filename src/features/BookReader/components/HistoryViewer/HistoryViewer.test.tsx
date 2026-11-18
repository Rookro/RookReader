import { error } from "@tauri-apps/plugin-log";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../../bindings/api";
import { createMockBookWithState } from "../../../../test/factories";
import { mockScrollToRow } from "../../../../test/mocks/components";
import { createReaderActionSpies, TestReader } from "../../../../test/readerInput";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import { fetchRecentlyReadBooks } from "../../../History/slice";
import { useHistoryIndex } from "../../hooks/useHistoryIndex";
import { ReaderInputProvider } from "../../input/ReaderInputContext";
import * as ReadReducer from "../../slice";
import HistoryViewer from "./HistoryViewer";

// Mock hooks
vi.mock("../../../History/hooks/useHistoryEntriesUpdater", () => ({
  useHistoryEntriesUpdater: vi.fn(),
}));
vi.mock("../../hooks/useHistoryIndex", () => ({
  useHistoryIndex: vi.fn(),
}));

// Mock SidePanelHeader
vi.mock("../../../SidePane/components/SidePanelHeader", () => ({
  default: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div data-testid="side-panel-header">
      {title}
      {actions}
    </div>
  ),
}));

// Mock actions
vi.mock("../../slice", async () => {
  const actual = await vi.importActual("../../slice");
  return {
    ...actual,
    openBook: vi.fn((payload: unknown) => ({ type: "reader/openBook", payload })),
  };
});

describe("HistoryViewer", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useHistoryIndex).mockReturnValue(-1);
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
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Book 1" }),
      createMockBookWithState({ id: 2, filePath: "/path/2", displayName: "Book 2" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });
    expect(screen.getByText("Book 1")).toBeInTheDocument();
    expect(screen.getByText("Book 2")).toBeInTheDocument();
  });

  it("should dispatch openBook when an item is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Book 1" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const rowButton = screen.getByRole("button", { name: /Book 1/i });
    await user.click(rowButton);

    expect(ReadReducer.openBook).toHaveBeenCalledWith({
      path: "/path/1",
      origin: { kind: "history" },
    });
  });

  it("returns Space to the reader after a row's right-click menu is closed", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Book 1" }),
    ];
    const actions = createReaderActionSpies();
    renderWithProviders(
      <ReaderInputProvider>
        <TestReader actions={actions} />
        <HistoryViewer />
      </ReaderInputProvider>,
      { preloadedState },
    );

    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Book 1") });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await user.keyboard(" ");

    expect(actions.nextPage).toHaveBeenCalledTimes(1);
    expect(ReadReducer.openBook).not.toHaveBeenCalled();
  });

  it("should filter results based on search input", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Apple" }),
      createMockBookWithState({ id: 2, filePath: "/path/2", displayName: "Banana" }),
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
      createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Apple" }),
    ];

    renderWithProviders(<HistoryViewer />, { preloadedState });

    const searchInput = screen.getByRole("searchbox");
    await user.type(searchInput, "Banana");

    expect(screen.getByText(/No results for "Banana"/i)).toBeInTheDocument();
  });

  it("should scroll to row when selectedIndex is set", async () => {
    vi.mocked(useHistoryIndex).mockReturnValue(1);

    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ filePath: "/path/1", displayName: "B1" }),
      createMockBookWithState({ filePath: "/path/2", displayName: "B2" }),
    ];
    preloadedState.reader.history = ["/path/2"];
    preloadedState.reader.historyIndex = 0;

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
    vi.mocked(useHistoryIndex).mockReturnValue(0);

    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [createMockBookWithState({ filePath: "/path/2" })];
    preloadedState.reader.history = ["/path/2"];
    preloadedState.reader.historyIndex = 0;

    mockScrollToRow.mockImplementationOnce(() => {
      throw new Error("Scroll error");
    });

    renderWithProviders(<HistoryViewer />, { preloadedState });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });
  });

  it("closes a row's context menu when a different book with the same name takes its place", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.recentlyReadBooks = [
      createMockBookWithState({ id: 1, filePath: "/a/Vol 1.cbz", displayName: "Vol 1.cbz" }),
    ];

    const { store } = renderWithProviders(<HistoryViewer />, { preloadedState });
    await user.pointer({ keys: "[MouseRight]", target: screen.getByText("Vol 1.cbz") });
    expect(screen.getByText("Remove history")).toBeInTheDocument();

    act(() => {
      store.dispatch(
        fetchRecentlyReadBooks.fulfilled(
          [createMockBookWithState({ id: 2, filePath: "/b/Vol 1.cbz", displayName: "Vol 1.cbz" })],
          "r1",
        ),
      );
    });

    expect(screen.queryByText("Remove history")).not.toBeInTheDocument();
  });

  it("should prevent context menu propagation", async () => {
    renderWithProviders(<HistoryViewer />, { preloadedState: createBasePreloadedState() });
    const searchInput = screen.getByRole("searchbox");

    const event = fireEvent.contextMenu(searchInput);
    expect(event).toBe(true);
  });

  describe("clearing all history", () => {
    const withHistory = () => {
      const preloadedState = createBasePreloadedState();
      preloadedState.history.recentlyReadBooks = [
        createMockBookWithState({ id: 1, filePath: "/path/1", displayName: "Book 1" }),
      ];
      return preloadedState;
    };

    it("is disabled while the history is empty", () => {
      renderWithProviders(<HistoryViewer />, { preloadedState: createBasePreloadedState() });

      expect(screen.getByRole("button", { name: "Clear all history" })).toBeDisabled();
    });

    it("clears every entry after the confirmation", async () => {
      const { store } = renderWithProviders(<HistoryViewer />, { preloadedState: withHistory() });

      await user.click(screen.getByRole("button", { name: "Clear all history" }));
      expect(
        screen.getByRole("dialog", { name: "Clear all reading history?" }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Clear all" }));

      await waitFor(() => expect(api.clearAllReadingHistory).toHaveBeenCalledTimes(1));
      expect(store.getState().history.recentlyReadBooks).toEqual([]);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("keeps the history when the confirmation is cancelled", async () => {
      const { store } = renderWithProviders(<HistoryViewer />, { preloadedState: withHistory() });

      await user.click(screen.getByRole("button", { name: "Clear all history" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(api.clearAllReadingHistory).not.toHaveBeenCalled();
      expect(store.getState().history.recentlyReadBooks).toHaveLength(1);
    });
  });
});
