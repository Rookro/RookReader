import { debug, error } from "@tauri-apps/plugin-log";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockScrollToRow } from "../../../../test/mocks/components";
import { createReaderActionSpies, TestReader } from "../../../../test/readerInput";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import { ReaderInputProvider } from "../../input/ReaderInputContext";
import * as ReadReducer from "../../slice";
import ImageEntriesViewer from "./ImageEntriesViewer";

// Mock SidePanelHeader
vi.mock("../../../SidePane/components/SidePanelHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="side-panel-header">{title}</div>,
}));

// Mock actions
vi.mock("../../slice", async () => {
  const actual = await vi.importActual("../../slice");
  return {
    ...actual,
    setImageIndex: vi.fn((payload: number) => ({ type: "reader/setImageIndex", payload })),
  };
});

describe("ImageEntriesViewer", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render SidePanelHeader", () => {
    renderWithProviders(<ImageEntriesViewer />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByTestId("side-panel-header")).toBeInTheDocument();
  });

  it("should show 'no pages' message when entries is empty", () => {
    renderWithProviders(<ImageEntriesViewer />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByText("No pages.")).toBeInTheDocument();
  });

  it("should render list items when entries are present", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = ["p1.jpg", "p2.jpg"];

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });
    expect(screen.getByText("p1.jpg")).toBeInTheDocument();
    expect(screen.getByText("p2.jpg")).toBeInTheDocument();
  });

  it("should select only the current page when a single page is displayed", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = ["p1.jpg", "p2.jpg", "p3.jpg"];
    preloadedState.reader.index = 1;
    preloadedState.reader.isSpreadDisplayed = false;

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });

    const buttons = screen.getAllByRole("option");
    expect(buttons[0]).not.toHaveClass("Mui-selected");
    expect(buttons[1]).toHaveClass("Mui-selected");
    expect(buttons[2]).not.toHaveClass("Mui-selected");
  });

  it("should select both displayed pages when a spread is displayed", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = ["p1.jpg", "p2.jpg", "p3.jpg"];
    preloadedState.reader.index = 1;
    preloadedState.reader.isSpreadDisplayed = true;

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });

    const buttons = screen.getAllByRole("option");
    expect(buttons[0]).not.toHaveClass("Mui-selected");
    expect(buttons[1]).toHaveClass("Mui-selected");
    expect(buttons[2]).toHaveClass("Mui-selected");
  });

  it("should not select a page past the end of the list on the last spread", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = ["p1.jpg", "p2.jpg"];
    preloadedState.reader.index = 1;
    preloadedState.reader.isSpreadDisplayed = true;

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });

    const buttons = screen.getAllByRole("option");
    expect(buttons).toHaveLength(2);
    expect(buttons[1]).toHaveClass("Mui-selected");
  });

  it("should dispatch setImageIndex when an item is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = ["p1.jpg", "p2.jpg"];

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });

    // The mock renders all items
    const rowButton = screen.getAllByRole("option")[1]; // Click second item
    await user.click(rowButton);

    expect(ReadReducer.setImageIndex).toHaveBeenCalledWith(1);
  });

  it("returns Space to the reader after a row is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = ["p1.jpg", "p2.jpg", "p3.jpg"];
    const actions = createReaderActionSpies();
    const { store } = renderWithProviders(
      <ReaderInputProvider>
        <TestReader actions={actions} />
        <ImageEntriesViewer />
      </ReaderInputProvider>,
      { preloadedState },
    );

    await user.click(screen.getAllByRole("option")[2]);
    expect(document.activeElement).toBe(document.body);
    // As if the page had turned since.
    act(() => {
      store.dispatch(ReadReducer.setImageIndex(0));
    });
    await user.keyboard(" ");

    expect(actions.nextPage).toHaveBeenCalledTimes(1);
    // The row was not clicked again.
    expect(store.getState().reader.index).toBe(0);
  });

  it("scrolls to the current row without logging", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = ["p1.jpg", "p2.jpg", "p3.jpg"];
    preloadedState.reader.index = 2;

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });

    await waitFor(() => {
      expect(mockScrollToRow).toHaveBeenCalledWith({
        align: "smart",
        behavior: "instant",
        index: 2,
      });
    });
    expect(debug).not.toHaveBeenCalled();
  });

  describe("keyboard", () => {
    const threePages = () => {
      const preloadedState = createBasePreloadedState();
      preloadedState.reader.entries = ["p1.jpg", "p2.jpg", "p3.jpg"];
      preloadedState.reader.index = 1;
      return preloadedState;
    };

    /** Renders the panel inside the side pane, next to a reader that records its page turns. */
    const renderInPane = (preloadedState = threePages()) => {
      const actions = createReaderActionSpies();
      const view = renderWithProviders(
        <ReaderInputProvider>
          <TestReader actions={actions} />
          <div data-side-pane="">
            <ImageEntriesViewer />
          </div>
        </ReaderInputProvider>,
        { preloadedState },
      );
      return { ...view, actions };
    };

    it("lands on the current page when the pane is entered", async () => {
      renderInPane();

      await user.keyboard("{F6}");

      const listbox = screen.getByRole("listbox", { name: "Pages" });
      expect(listbox).toHaveFocus();
      expect(listbox).toHaveAttribute(
        "aria-activedescendant",
        screen.getByRole("option", { name: "p2.jpg" }).id,
      );
    });

    it("moves with the arrow keys without turning the page", async () => {
      const { actions } = renderInPane();

      await user.keyboard("{F6}{ArrowDown}");

      expect(screen.getByRole("listbox")).toHaveAttribute(
        "aria-activedescendant",
        screen.getByRole("option", { name: "p3.jpg" }).id,
      );
      expect(actions.nextPage).not.toHaveBeenCalled();
    });

    it("scrolls to the current page when the pane is entered before the panel mounts", async () => {
      const preloadedState = createBasePreloadedState();
      preloadedState.reader.entries = Array.from({ length: 50 }, (_, i) => `p${i + 1}.jpg`);
      preloadedState.reader.index = 40;
      const actions = createReaderActionSpies();
      const ui = (showPanel: boolean) => (
        <ReaderInputProvider>
          <TestReader actions={actions} />
          <div data-side-pane="">{showPanel && <ImageEntriesViewer />}</div>
        </ReaderInputProvider>
      );
      // As with Ctrl+Tab, the request waits for the panel to mount.
      const { rerender } = renderWithProviders(ui(false), { preloadedState });
      await user.keyboard("{F6}");
      rerender(ui(true));
      // Past the current page's 20 ms scroll, which the focused list skips.
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

      expect(screen.getByRole("listbox")).toHaveFocus();
      expect(mockScrollToRow).toHaveBeenCalledWith({
        align: "smart",
        behavior: "instant",
        index: 40,
      });
    });

    it("keeps the active page, not the current one, in view while the list has focus", async () => {
      renderInPane();

      await user.keyboard("{F6}{ArrowDown}");
      // Past the current page's 20 ms scroll.
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

      expect(mockScrollToRow).toHaveBeenLastCalledWith({
        align: "smart",
        behavior: "instant",
        index: 2,
      });
    });

    it("jumps to the active page with Enter and returns the keys to the reader", async () => {
      const { store, actions } = renderInPane();

      await user.keyboard("{F6}{ArrowDown}{Enter}");
      expect(store.getState().reader.index).toBe(2);

      await user.keyboard("{ArrowDown}");
      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("makes a clicked page the active row", async () => {
      renderInPane();

      await user.click(screen.getByRole("option", { name: "p3.jpg" }));

      expect(screen.getByRole("listbox")).toHaveAttribute(
        "aria-activedescendant",
        screen.getByRole("option", { name: "p3.jpg" }).id,
      );
    });

    it("keeps the page turning after a right-click on a row", async () => {
      const { actions } = renderInPane();

      await user.pointer({
        keys: "[MouseRight]",
        target: screen.getByRole("option", { name: "p2.jpg" }),
      });
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("keeps the page turning after a click on the list's empty area", async () => {
      const { actions } = renderInPane();

      await user.click(screen.getByRole("listbox"));
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("keeps the page turning after a click on the panel's title", async () => {
      const { actions } = renderInPane();

      await user.click(screen.getByTestId("side-panel-header"));
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("keeps the page turning after a click on the 'no pages' message", async () => {
      const { actions } = renderInPane(createBasePreloadedState());

      await user.click(screen.getByText("No pages."));
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("keeps the page turning after a click on the panel's title while the list has focus", async () => {
      const { actions } = renderInPane();

      await user.keyboard("{F6}");
      await user.click(screen.getByTestId("side-panel-header"));
      await user.keyboard("{ArrowDown}");

      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("logs a failed keyboard scroll", async () => {
      renderInPane();
      await waitFor(() => expect(mockScrollToRow).toHaveBeenCalled());
      mockScrollToRow.mockImplementationOnce(() => {
        throw new Error("Scroll failed");
      });

      await user.keyboard("{F6}");

      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 1"));
    });

    it("focuses the panel when there are no pages", async () => {
      const { actions } = renderInPane(createBasePreloadedState());

      await user.keyboard("{F6}");
      expect(document.activeElement).toBe(screen.getByTestId("side-panel-header").parentElement);

      await user.keyboard("{ArrowDown}");
      expect(actions.nextPage).not.toHaveBeenCalled();
    });
  });

  it("should log error if scrollToRow fails", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = ["p1.jpg"];
    preloadedState.reader.index = 0;

    mockScrollToRow.mockImplementationOnce(() => {
      throw new Error("Scroll failed");
    });

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });
  });
});
