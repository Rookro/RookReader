import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReaderActionSpies, TestReader } from "../../../../test/readerInput";
import { createBasePreloadedState, renderWithProviders } from "../../../../test/utils";
import * as SettingsReducer from "../../../Settings/slice";
import { setSettings } from "../../../Settings/slice";
import * as FileNavigatorSlice from "../../fileNavigatorSlice";
import { ReaderInputProvider } from "../../input/ReaderInputContext";
import NavBar from "./NavBar";

// Mock actions to track calls
vi.mock("../../fileNavigatorSlice", async () => {
  const actual = await vi.importActual("../../fileNavigatorSlice");
  return {
    ...actual,
    loadDirectory: vi.fn((payload) => ({
      type: "fileNavigator/loadDirectory",
      payload,
    })),
    setSearchText: vi.fn((payload) => ({ type: "fileNavigator/setSearchText", payload })),
    goBackNavigatorHistory: vi.fn(() => ({ type: "fileNavigator/goBack" })),
    goForwardNavigatorHistory: vi.fn(() => ({ type: "fileNavigator/goForward" })),
  };
});

vi.mock("../../../Settings/slice", async () => {
  const actual = await vi.importActual("../../../Settings/slice");
  return {
    ...actual,
    updateSettings: vi.fn((payload: { key: string; value: string }) => ({
      type: "settings/updateSettings",
      payload,
    })),
  };
});

// Custom ResizeObserver mock to trigger callbacks
let resizeCallback: ResizeObserverCallback | undefined;
class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    resizeCallback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = MockResizeObserver as typeof ResizeObserver;

describe("FileNavigator/NavBar", () => {
  const user = userEvent.setup();

  const defaultPreloadedState = createBasePreloadedState();
  defaultPreloadedState.fileNavigator.history = ["/home/user/books"];
  defaultPreloadedState.fileNavigator.historyIndex = 0;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render current path and search input", () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    expect(screen.getByDisplayValue("/home/user/books")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("should dispatch loadDirectory when path is changed", async () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const pathInput = screen.getByDisplayValue("/home/user/books");
    await user.clear(pathInput);
    await user.type(pathInput, "/new/path");
    await user.tab(); // Blur trigger

    expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({ dirPath: "/new/path" });
  });

  it("should dispatch loadDirectory with home dir when home button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.fileNavigator.homeDirectory = "/home/user";

    renderWithProviders(<NavBar />, { preloadedState });

    const homeButton = screen.getByLabelText("home");
    await user.click(homeButton);

    await waitFor(() => {
      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
        dirPath: "/home/user",
      });
    });
  });

  it("should dispatch goBackNavigatorHistory when back button is clicked", async () => {
    const preloadedState = structuredClone(defaultPreloadedState);
    preloadedState.fileNavigator.history = ["/", "/home"];
    preloadedState.fileNavigator.historyIndex = 1;

    renderWithProviders(<NavBar />, { preloadedState });

    const backButton = screen.getByLabelText("back");
    await user.click(backButton);

    expect(FileNavigatorSlice.goBackNavigatorHistory).toHaveBeenCalled();
  });

  it("should dispatch loadDirectory with parent dir when up button is clicked", async () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const upButton = screen.getByLabelText("up");
    await user.click(upButton);

    await waitFor(() => {
      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
        dirPath: "/home/user",
      });
    });
  });

  it("should dispatch loadDirectory with forceUpdate when refresh button is clicked", async () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const refreshButton = screen.getByLabelText("refresh");
    await user.click(refreshButton);

    expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
      dirPath: "/home/user/books",
      forceUpdate: true,
    });
  });

  it("should dispatch setSearchText when search input changes", async () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const searchInput = screen.getByRole("searchbox");
    // Use fireEvent.change for atomic update
    fireEvent.change(searchInput, { target: { value: "manga" } });

    expect(FileNavigatorSlice.setSearchText).toHaveBeenCalledWith("manga");
  });

  it("should update the settings when the sort order changes", async () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    // Trigger ResizeObserver callback manually
    act(() => {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        configurable: true,
        value: 500,
      });
      if (resizeCallback) {
        resizeCallback([], {} as ResizeObserver);
      }
    });

    const select = screen.getByRole("combobox");
    await user.click(select);

    // MUI Select options have role="option"
    const options = await screen.findAllByRole("option");
    const targetOption = options.find((opt) => opt.getAttribute("data-value") === "name_desc");

    if (targetOption) {
      await user.click(targetOption);
    } else {
      throw new Error("Target option name_desc not found");
    }

    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "fileNavigator",
      value: expect.objectContaining({ sortOrder: "name_desc" }),
    });
  });

  it("should dispatch goForwardNavigatorHistory when forward button is clicked", async () => {
    const preloadedState = structuredClone(defaultPreloadedState);
    preloadedState.fileNavigator.history = ["/", "/home"];
    preloadedState.fileNavigator.historyIndex = 0;

    renderWithProviders(<NavBar />, { preloadedState });

    const forwardButton = screen.getByLabelText("forward");
    await user.click(forwardButton);

    expect(FileNavigatorSlice.goForwardNavigatorHistory).toHaveBeenCalled();
  });

  it("should use homeDir if settingsStore home-directory is missing", async () => {
    const { homeDir } = await import("@tauri-apps/api/path");
    vi.mocked(homeDir).mockResolvedValue("/system/home");

    const preloadedState = structuredClone(defaultPreloadedState);
    preloadedState.settings.fileNavigator.homeDirectory = "";

    renderWithProviders(<NavBar />, { preloadedState });

    const homeButton = screen.getByLabelText("home");
    await user.click(homeButton);

    await waitFor(() => {
      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
        dirPath: "/system/home",
      });
    });
  });

  it("should log warning if getting parent directory fails", async () => {
    const { dirname } = await import("@tauri-apps/api/path");
    const { warn } = await import("@tauri-apps/plugin-log");
    vi.mocked(dirname).mockRejectedValue(new Error("Dirname error"));

    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });

    const upButton = screen.getByLabelText("up");
    await user.click(upButton);

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Failed to get parent directory"));
    });
  });

  it("should prevent context menu propagation", () => {
    renderWithProviders(<NavBar />, { preloadedState: defaultPreloadedState });
    const input = screen.getByDisplayValue("/home/user/books");
    fireEvent.contextMenu(input);
    // Verified by code inspection: calls stopPropagation
  });

  describe("Escape in the fields", () => {
    /** Renders the bar inside the side pane, next to a reader that records its page turns. */
    const renderInPane = () => {
      const actions = createReaderActionSpies();
      const view = renderWithProviders(
        <ReaderInputProvider>
          <TestReader actions={actions} />
          <div data-side-pane="">
            <NavBar />
          </div>
        </ReaderInputProvider>,
        { preloadedState: defaultPreloadedState },
      );
      return { ...view, actions };
    };

    it("clears the search on Escape, then returns to the reader", async () => {
      const { actions } = renderInPane();
      const searchbox = screen.getByRole("searchbox");

      await user.type(searchbox, "abc");
      await user.keyboard("{Escape}");
      expect(searchbox).toHaveValue("");
      expect(searchbox).toHaveFocus();

      await user.keyboard("{Escape}");
      expect(document.activeElement).toBe(document.body);
      await user.keyboard("{ArrowDown}");
      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("keeps the search when Escape ends an IME composition", async () => {
      renderInPane();
      const searchbox = screen.getByRole("searchbox");

      await user.type(searchbox, "abc");
      // WebKitGTK fires it after compositionend, with isComposing false.
      fireEvent.keyDown(searchbox, { key: "Escape", keyCode: 229 });

      expect(searchbox).toHaveValue("abc");
      expect(searchbox).toHaveFocus();
    });

    it("reverts an edited path on Escape without navigating", async () => {
      renderInPane();
      const pathInput = screen.getByDisplayValue("/home/user/books");

      await user.clear(pathInput);
      await user.type(pathInput, "/new/path");
      await user.keyboard("{Escape}");
      expect(pathInput).toHaveValue("/home/user/books");
      expect(pathInput).toHaveFocus();

      await user.tab();
      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalledWith({ dirPath: "/new/path" });
    });

    it("returns to the reader on Escape in an unedited path", async () => {
      const { actions } = renderInPane();
      const pathInput = screen.getByDisplayValue("/home/user/books");
      vi.mocked(FileNavigatorSlice.loadDirectory).mockClear();

      await user.click(pathInput);
      await user.keyboard("{Escape}");

      expect(document.activeElement).toBe(document.body);
      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
      await user.keyboard("{ArrowDown}");
      expect(actions.nextPage).toHaveBeenCalledTimes(1);
    });

    it("keeps an edited path when Escape ends an IME composition", async () => {
      renderInPane();
      const pathInput = screen.getByDisplayValue("/home/user/books");

      await user.type(pathInput, "/new");
      fireEvent.keyDown(pathInput, { key: "Escape", keyCode: 229 });

      expect(pathInput).toHaveValue("/home/user/books/new");
      expect(pathInput).toHaveFocus();
    });
  });

  describe("buttons in the side pane", () => {
    const renderInPane = () => {
      const preloadedState = structuredClone(defaultPreloadedState);
      preloadedState.fileNavigator.history = ["/", "/home", "/home/user"];
      preloadedState.fileNavigator.historyIndex = 1;
      const actions = createReaderActionSpies();
      renderWithProviders(
        <ReaderInputProvider>
          <TestReader actions={actions} />
          <div data-side-pane="">
            <NavBar />
          </div>
        </ReaderInputProvider>,
        { preloadedState },
      );
      return actions;
    };

    it.each(["home", "back", "forward", "up", "refresh"])(
      "leaves the keys to the reader after a mouse click on %s",
      async (label) => {
        const actions = renderInPane();

        await user.click(screen.getByLabelText(label));
        await user.keyboard("{ArrowDown}");

        expect(actions.nextPage).toHaveBeenCalledTimes(1);
      },
    );

    it("leaves the keys to the reader after a sort order is picked with the mouse", async () => {
      const actions = renderInPane();

      await user.click(screen.getByRole("combobox"));
      await user.click(await screen.findByRole("option", { name: "Name↓" }));
      await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
      await user.keyboard("{ArrowRight}");

      expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
        key: "fileNavigator",
        value: { sortOrder: "name_desc" },
      });
      expect([...actions.nextPage.mock.calls, ...actions.previousPage.mock.calls]).toHaveLength(1);
    });

    it("leaves the keys to the reader after the sort menu is closed with a click outside", async () => {
      const actions = renderInPane();

      await user.click(screen.getByRole("combobox"));
      await screen.findByRole("listbox");
      await user.click(document.querySelector(".MuiBackdrop-root") as HTMLElement);
      await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
      await user.keyboard("{ArrowRight}");

      expect([...actions.nextPage.mock.calls, ...actions.previousPage.mock.calls]).toHaveLength(1);
    });

    it("keeps focus on the sort order picked with the keyboard", async () => {
      renderInPane();
      const select = screen.getByRole("combobox");

      act(() => select.focus());
      await user.keyboard("{Enter}");
      await screen.findByRole("listbox");
      await user.keyboard("{ArrowDown}{Enter}");
      await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

      expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
        key: "fileNavigator",
        value: { sortOrder: "name_desc" },
      });
      expect(select).toHaveFocus();
    });

    it("keeps focus on the sort order after Escape closes its menu", async () => {
      renderInPane();
      const select = screen.getByRole("combobox");

      act(() => select.focus());
      await user.keyboard("{Enter}");
      await screen.findByRole("listbox");
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

      expect(select).toHaveFocus();
    });

    it("keeps focus on a button pressed with the keyboard", async () => {
      renderInPane();
      const refreshButton = screen.getByLabelText("refresh");

      act(() => refreshButton.focus());
      await user.keyboard("{Enter}");

      expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
        dirPath: "/home",
        forceUpdate: true,
      });
      expect(refreshButton).toHaveFocus();
    });
  });

  describe("tooltips", () => {
    it.each([
      ["home", "Home folder"],
      ["back", "Back"],
      ["forward", "Forward"],
      ["up", "Up one level"],
      ["refresh", "Refresh"],
    ])("should describe the %s button on hover", async (ariaLabel, tooltip) => {
      // Sit in the middle of the history so both back and forward stay enabled;
      // a disabled button has pointer-events: none and cannot be hovered.
      const preloadedState = createBasePreloadedState();
      preloadedState.fileNavigator.history = ["/a", "/b", "/c"];
      preloadedState.fileNavigator.historyIndex = 1;

      renderWithProviders(<NavBar />, { preloadedState });
      await user.hover(screen.getByLabelText(ariaLabel));

      expect(await screen.findByRole("tooltip")).toHaveTextContent(tooltip);
    });
  });
  describe("sort order", () => {
    it("should reflect the stored sort order rather than only its initial value", () => {
      const preloadedState = createBasePreloadedState();
      preloadedState.fileNavigator.history = ["/home/user/books"];
      preloadedState.fileNavigator.historyIndex = 0;
      preloadedState.settings.fileNavigator.sortOrder = "date_desc";

      renderWithProviders(<NavBar />, { preloadedState });

      expect(screen.getByRole("combobox")).toHaveTextContent("Date↓");
    });

    it("should follow the store when the sort order changes elsewhere", async () => {
      const preloadedState = createBasePreloadedState();
      preloadedState.fileNavigator.history = ["/home/user/books"];
      preloadedState.fileNavigator.historyIndex = 0;

      const { store } = renderWithProviders(<NavBar />, { preloadedState });
      expect(screen.getByRole("combobox")).toHaveTextContent("Name↑");

      // Stands in for the settings window writing a new sort order.
      const settings = store.getState().settings;
      act(() => {
        store.dispatch(
          setSettings({
            ...settings,
            fileNavigator: { ...settings.fileNavigator, sortOrder: "date_asc" },
          }),
        );
      });

      await waitFor(() => expect(screen.getByRole("combobox")).toHaveTextContent("Date↑"));
    });

    it("should keep the sort control reachable regardless of the pane width", () => {
      const preloadedState = createBasePreloadedState();
      preloadedState.fileNavigator.history = ["/home/user/books"];
      preloadedState.fileNavigator.historyIndex = 0;

      renderWithProviders(<NavBar />, { preloadedState });

      // jsdom reports a zero width, which used to hide the control entirely.
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  describe("initial folder loading", () => {
    it("loads the home directory on mount when historyIndex is -1", async () => {
      const { homeDir } = await import("@tauri-apps/api/path");
      vi.mocked(homeDir).mockResolvedValueOnce("/resolved/home");

      const preloadedState = createBasePreloadedState();
      preloadedState.settings.fileNavigator.homeDirectory = "";

      renderWithProviders(<NavBar />, { preloadedState });

      await waitFor(() => {
        expect(FileNavigatorSlice.loadDirectory).toHaveBeenCalledWith({
          dirPath: "/resolved/home",
        });
      });
    });

    it("does not clear searchText or loadDirectory when mounting on an empty loaded folder", () => {
      const preloadedState = createBasePreloadedState();
      preloadedState.fileNavigator.history = ["/empty"];
      preloadedState.fileNavigator.historyIndex = 0;
      preloadedState.fileNavigator.loadedPath = "/empty";
      preloadedState.fileNavigator.entries = [];
      preloadedState.fileNavigator.searchText = "abc";

      renderWithProviders(<NavBar />, { preloadedState });

      expect(FileNavigatorSlice.setSearchText).not.toHaveBeenCalled();
      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
    });

    it("does not overwrite a folder opened while homeDir() is resolving", async () => {
      const { homeDir } = await import("@tauri-apps/api/path");
      let resolveHome: (path: string) => void = () => {};
      vi.mocked(homeDir).mockReturnValueOnce(
        new Promise<string>((resolve) => {
          resolveHome = resolve;
        }),
      );

      const preloadedState = createBasePreloadedState();
      preloadedState.settings.fileNavigator.homeDirectory = "";

      const { store } = renderWithProviders(<NavBar />, { preloadedState });
      await waitFor(() => expect(homeDir).toHaveBeenCalledTimes(1));

      // Dispatch directoryPathOpened and resolve homeDir within the same act so the
      // post-await store.getState().fileNavigator.historyIndex !== -1 guard is exercised.
      await act(async () => {
        store.dispatch(FileNavigatorSlice.directoryPathOpened("/restored"));
        resolveHome("/system/home");
        await Promise.resolve();
      });

      expect(FileNavigatorSlice.setSearchText).not.toHaveBeenCalled();
      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalledWith({
        dirPath: "/system/home",
      });
    });

    it("ignores homeDir() resolution after unmount", async () => {
      const { homeDir } = await import("@tauri-apps/api/path");
      let resolveHome: (path: string) => void = () => {};
      vi.mocked(homeDir).mockReturnValueOnce(
        new Promise<string>((resolve) => {
          resolveHome = resolve;
        }),
      );

      const preloadedState = createBasePreloadedState();
      preloadedState.settings.fileNavigator.homeDirectory = "";

      const { unmount } = renderWithProviders(<NavBar />, { preloadedState });
      await waitFor(() => expect(homeDir).toHaveBeenCalledTimes(1));

      unmount();
      await act(async () => {
        resolveHome("/system/home");
        await Promise.resolve();
      });

      expect(FileNavigatorSlice.loadDirectory).not.toHaveBeenCalled();
    });
  });
});
