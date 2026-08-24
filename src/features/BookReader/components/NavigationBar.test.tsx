import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookmarkCommands from "../../../bindings/BookmarkCommands";
import { createMockBookmark, createMockBookWithState } from "../../../test/factories";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../test/utils";
import * as SettingsReducer from "../../Settings/slice";
import NavigationBar from "./NavigationBar";

describe("NavigationBar", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
    vi.spyOn(SettingsReducer, "updateSettings");
  });

  it("should dispatch setActiveView('bookshelf') when library button is clicked", async () => {
    const { store } = renderWithProviders(<NavigationBar />);

    const libraryButton = screen.getByRole("button", { name: "library" });
    await user.click(libraryButton);

    expect(store.getState().view.activeView).toBe("bookshelf");
  });

  it("should dispatch goBackContainerHistory when back button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/1", "/path/2"];
    preloadedState.read.containerFile.historyIndex = 1;
    preloadedState.read.containerFile.entries = [];
    preloadedState.read.containerFile.index = 0;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const backButton = screen.getByLabelText("back");
    await user.click(backButton);

    expect(store.getState().read.containerFile.historyIndex).toBe(0);
  });

  it("should disable back button if historyIndex <= 0", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/1"];
    preloadedState.read.containerFile.historyIndex = 0;
    preloadedState.read.containerFile.entries = [];
    preloadedState.read.containerFile.index = 0;

    renderWithProviders(<NavigationBar />, { preloadedState });

    const backButton = screen.getByLabelText("back");
    expect(backButton).toBeDisabled();
  });

  it("should toggle isTwoPagedView when button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.view.activeView = "reader" as const;
    preloadedState.settings.reader.comic.enableSpread = true;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const toggleButton = screen.getByLabelText("toggle-two-paged");
    await user.click(toggleButton);

    expect(store.getState().settings.reader.comic.enableSpread).toBe(false);
    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "reader",
      value: expect.objectContaining({ comic: expect.objectContaining({ enableSpread: false }) }),
    });
  });

  it("should shift the spread pairing when the button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.view.activeView = "reader" as const;
    preloadedState.settings.reader.comic.enableSpread = true;
    preloadedState.read.containerFile.entries = ["p1", "p2", "p3", "p4"];
    preloadedState.read.containerFile.index = 2;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    await user.click(screen.getByLabelText("shift-spread"));

    expect(store.getState().read.containerFile.isSpreadShifted).toBe(true);
  });

  it("should reset the spread pairing when it is already shifted", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.view.activeView = "reader" as const;
    preloadedState.settings.reader.comic.enableSpread = true;
    preloadedState.read.containerFile.entries = ["p1", "p2", "p3"];
    preloadedState.read.containerFile.isSpreadShifted = true;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    await user.click(screen.getByLabelText("shift-spread"));

    expect(store.getState().read.containerFile.isSpreadShifted).toBe(false);
  });

  it("should disable the shift-spread button when spread mode is off", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.view.activeView = "reader" as const;
    preloadedState.settings.reader.comic.enableSpread = false;
    preloadedState.read.containerFile.entries = ["p1", "p2", "p3"];

    renderWithProviders(<NavigationBar />, { preloadedState });

    expect(screen.getByLabelText("shift-spread")).toBeDisabled();
  });

  it("should toggle direction when button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.view.activeView = "reader" as const;
    preloadedState.settings.reader.comic.readingDirection = "ltr" as const;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const directionButton = screen.getByLabelText("toggle-direction");
    await user.click(directionButton);

    expect(store.getState().settings.reader.comic.readingDirection).toBe("rtl");
    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "reader",
      value: expect.objectContaining({
        comic: expect.objectContaining({ readingDirection: "rtl" }),
      }),
    });
  });

  it("should dispatch goForwardContainerHistory when forward button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/1", "/path/2"];
    preloadedState.read.containerFile.historyIndex = 0;
    preloadedState.read.containerFile.entries = [];
    preloadedState.read.containerFile.index = 0;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const forwardButton = screen.getByLabelText("forward");
    await user.click(forwardButton);

    expect(store.getState().read.containerFile.historyIndex).toBe(1);
  });

  it("should disable forward button if historyIndex is at the end", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/1"];
    preloadedState.read.containerFile.historyIndex = 0;
    preloadedState.read.containerFile.entries = [];
    preloadedState.read.containerFile.index = 0;

    renderWithProviders(<NavigationBar />, { preloadedState });

    const forwardButton = screen.getByLabelText("forward");
    expect(forwardButton).toBeDisabled();
  });

  it("should toggle direction from rtl to ltr when button is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.view.activeView = "reader" as const;
    preloadedState.settings.reader.comic.readingDirection = "rtl" as const;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const directionButton = screen.getByLabelText("toggle-direction");
    await user.click(directionButton);

    expect(store.getState().settings.reader.comic.readingDirection).toBe("ltr");
    expect(SettingsReducer.updateSettings).toHaveBeenCalledWith({
      key: "reader",
      value: expect.objectContaining({
        comic: expect.objectContaining({ readingDirection: "ltr" }),
      }),
    });
  });

  it("should dispatch setContainerFilePath when path input is submitted", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/old"];
    preloadedState.read.containerFile.historyIndex = 0;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const input = screen.getByLabelText("container-path-input");
    await user.clear(input);
    await user.type(input, "/path/new{enter}");

    expect(store.getState().read.containerFile.history).toContain("/path/new");
  });

  it("should trigger form submission on blur", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.history = ["/path/old"];
    preloadedState.read.containerFile.historyIndex = 0;

    const { store } = renderWithProviders(<NavigationBar />, { preloadedState });

    const input = screen.getByLabelText("container-path-input");
    await user.clear(input);
    await user.type(input, "/path/blur");
    await user.tab(); // Trigger blur

    expect(store.getState().read.containerFile.history).toContain("/path/blur");
  });

  it("should prevent context menu propagation on input", () => {
    renderWithProviders(<NavigationBar />);

    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

    screen.getByLabelText("container-path-input").dispatchEvent(event);

    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it("should open settings window when button is clicked", async () => {
    renderWithProviders(<NavigationBar />);

    const settingsButton = screen.getByLabelText("settings");
    await user.click(settingsButton);

    expect(WebviewWindow).toHaveBeenCalledWith("settings", expect.anything());
  });

  describe("bookmark toggle", () => {
    /** Builds a state with a book open at `index`, optionally as a novel at `cfi`. */
    const stateWithOpenBook = (options?: {
      index?: number;
      cfi?: string | null;
      isNovel?: boolean;
      entries?: string[];
    }) => {
      const preloadedState = createBasePreloadedState();
      preloadedState.read.containerFile.history = ["/path/book.zip"];
      preloadedState.read.containerFile.historyIndex = 0;
      preloadedState.read.containerFile.book = createMockBookWithState({ id: 42 });
      preloadedState.read.containerFile.index = options?.index ?? 3;
      preloadedState.read.containerFile.cfi = options?.cfi ?? null;
      preloadedState.read.containerFile.isNovel = options?.isNovel ?? false;
      preloadedState.read.containerFile.entries = options?.entries ?? ["p1", "p2", "p3", "p4"];
      return preloadedState;
    };

    it("should be disabled while no book is open", () => {
      renderWithProviders(<NavigationBar />);

      expect(screen.getByLabelText("toggle-bookmark")).toBeDisabled();
    });

    it("should add a bookmark named after the page number for a comic", async () => {
      const preloadedState = stateWithOpenBook();
      vi.mocked(BookmarkCommands.createBookmark).mockResolvedValue(
        createMockBookmark({ id: 1, book_id: 42, page_index: 3 }),
      );

      renderWithProviders(<NavigationBar />, { preloadedState });
      await user.click(screen.getByLabelText("toggle-bookmark"));

      await waitFor(() => {
        expect(BookmarkCommands.createBookmark).toHaveBeenCalledWith({
          bookId: 42,
          name: "Page 4",
          pageIndex: 3,
          cfi: null,
        });
      });
    });

    it("should add a bookmark named after the section label for a novel", async () => {
      const preloadedState = stateWithOpenBook({
        index: 1,
        cfi: "epubcfi(/6/8!/4/2/1:0)",
        isNovel: true,
        entries: ["Chapter 1", "Chapter 2"],
      });
      vi.mocked(BookmarkCommands.createBookmark).mockResolvedValue(
        createMockBookmark({ id: 1, book_id: 42, page_index: 1 }),
      );

      renderWithProviders(<NavigationBar />, { preloadedState });
      await user.click(screen.getByLabelText("toggle-bookmark"));

      await waitFor(() => {
        expect(BookmarkCommands.createBookmark).toHaveBeenCalledWith({
          bookId: 42,
          name: "Chapter 2",
          pageIndex: 1,
          cfi: "epubcfi(/6/8!/4/2/1:0)",
        });
      });
    });

    it("should remove the bookmark when the current position is already bookmarked", async () => {
      const preloadedState = stateWithOpenBook();
      preloadedState.bookmark.bookmarks = [
        createMockBookmark({ id: 7, book_id: 42, page_index: 3, cfi: null }),
      ];

      renderWithProviders(<NavigationBar />, { preloadedState });
      await user.click(screen.getByLabelText("toggle-bookmark"));

      await waitFor(() => {
        expect(BookmarkCommands.deleteBookmark).toHaveBeenCalledWith(7);
      });
      expect(BookmarkCommands.createBookmark).not.toHaveBeenCalled();
    });

    it("should match a novel bookmark by CFI rather than page index", async () => {
      const preloadedState = stateWithOpenBook({
        index: 1,
        cfi: "epubcfi(/6/8!/4/2/1:0)",
        isNovel: true,
        entries: ["Chapter 1", "Chapter 2"],
      });
      // Same section, different position: this is not the current bookmark.
      preloadedState.bookmark.bookmarks = [
        createMockBookmark({ id: 7, book_id: 42, page_index: 1, cfi: "epubcfi(/6/8!/4/2/9:0)" }),
      ];
      vi.mocked(BookmarkCommands.createBookmark).mockResolvedValue(
        createMockBookmark({ id: 8, book_id: 42, page_index: 1 }),
      );

      renderWithProviders(<NavigationBar />, { preloadedState });
      await user.click(screen.getByLabelText("toggle-bookmark"));

      await waitFor(() => {
        expect(BookmarkCommands.createBookmark).toHaveBeenCalled();
      });
      expect(BookmarkCommands.deleteBookmark).not.toHaveBeenCalled();
    });
  });

  describe("tooltips", () => {
    it.each([
      ["back", "Back"],
      ["forward", "Forward"],
      ["toggle-two-paged", "Toggle two-page spread"],
      ["toggle-direction", "Toggle reading direction"],
      ["settings", "Settings"],
    ])("should describe the %s button on hover", async (ariaLabel, tooltip) => {
      // Sit in the middle of the history so both back and forward stay enabled;
      // a disabled button has pointer-events: none and cannot be hovered.
      const preloadedState = createBasePreloadedState();
      preloadedState.read.containerFile.history = ["/path/1", "/path/2", "/path/3"];
      preloadedState.read.containerFile.historyIndex = 1;

      renderWithProviders(<NavigationBar />, { preloadedState });
      await user.hover(screen.getByLabelText(ariaLabel));

      expect(await screen.findByRole("tooltip")).toHaveTextContent(tooltip);
    });
  });
});
