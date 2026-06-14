import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AppStore,
  createBasePreloadedState,
  createTestStore,
  type RootState,
  testI18n,
} from "../../../test/utils";
import { setContainerFilePath, setOpenOrigin, setPendingInitialPosition } from "../slice";
import { resolveAdjacentBook } from "../utils/AdjacentBookResolver";
import { useAdjacentBookNavigation } from "./useAdjacentBookNavigation";

const { showNotification } = vi.hoisted(() => ({ showNotification: vi.fn() }));

vi.mock("../../../components/ui/Notification/NotificationContext", () => ({
  useNotification: () => ({ showNotification }),
}));

vi.mock("../utils/AdjacentBookResolver", () => ({
  resolveAdjacentBook: vi.fn(),
}));

const mockedResolve = vi.mocked(resolveAdjacentBook);

const buildState = (mode: "off" | "ask" | "auto"): RootState => {
  const state = createBasePreloadedState();
  state.settings.reader.autoOpenAdjacentBook = mode;
  state.read.containerFile.history = ["/dir/book1.zip"];
  state.read.containerFile.historyIndex = 0;
  state.read.containerFile.origin = { kind: "fileNavigator" };
  return state;
};

const renderTrigger = (state: RootState) => {
  const store: AppStore = createTestStore(state);
  const dispatchSpy = vi.spyOn(store, "dispatch");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
    </Provider>
  );
  const { result } = renderHook(() => useAdjacentBookNavigation(), { wrapper });
  return { result, dispatchSpy };
};

describe("useAdjacentBookNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when the mode is off", async () => {
    const { result, dispatchSpy } = renderTrigger(buildState("off"));

    await act(async () => {
      result.current.onForwardBoundary();
    });

    expect(mockedResolve).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("auto-opens the next book and shows a toast", async () => {
    mockedResolve.mockResolvedValue({ filePath: "/dir/book2.zip", displayName: "Book 2" });
    const { result, dispatchSpy } = renderTrigger(buildState("auto"));

    await act(async () => {
      result.current.onForwardBoundary();
    });

    expect(mockedResolve).toHaveBeenCalledWith(
      null,
      "/dir/book1.zip",
      { kind: "fileNavigator" },
      "next",
      "name_asc",
    );
    expect(dispatchSpy).toHaveBeenCalledWith(setOpenOrigin({ kind: "fileNavigator" }));
    expect(dispatchSpy).toHaveBeenCalledWith(setContainerFilePath("/dir/book2.zip"));
    expect(dispatchSpy).not.toHaveBeenCalledWith(setPendingInitialPosition("last"));
    expect(showNotification).toHaveBeenCalledWith(expect.stringContaining("Book 2"), "info");
  });

  it("opens the previous book on its last page", async () => {
    mockedResolve.mockResolvedValue({ filePath: "/dir/book0.zip", displayName: "Book 0" });
    const { result, dispatchSpy } = renderTrigger(buildState("auto"));

    await act(async () => {
      result.current.onBackwardBoundary();
    });

    expect(dispatchSpy).toHaveBeenCalledWith(setPendingInitialPosition("last"));
    expect(dispatchSpy).toHaveBeenCalledWith(setContainerFilePath("/dir/book0.zip"));
    expect(showNotification).toHaveBeenCalledWith(expect.stringContaining("Book 0"), "info");
  });

  it("shows a 'no next book' toast when none is found", async () => {
    mockedResolve.mockResolvedValue(null);
    const { result, dispatchSpy } = renderTrigger(buildState("auto"));

    await act(async () => {
      result.current.onForwardBoundary();
    });

    expect(showNotification).toHaveBeenCalledWith("No next book found.", "info");
    expect(dispatchSpy).not.toHaveBeenCalledWith(setContainerFilePath("/dir/book2.zip"));
  });

  it("asks for confirmation in 'ask' mode before opening", async () => {
    mockedResolve.mockResolvedValue({ filePath: "/dir/book2.zip", displayName: "Book 2" });
    const { result, dispatchSpy } = renderTrigger(buildState("ask"));

    await act(async () => {
      result.current.onForwardBoundary();
    });

    // Pending is set; nothing is opened yet.
    expect(result.current.pending).toEqual({
      book: { filePath: "/dir/book2.zip", displayName: "Book 2" },
      direction: "next",
    });
    expect(dispatchSpy).not.toHaveBeenCalledWith(setContainerFilePath("/dir/book2.zip"));

    // Confirming opens the book.
    act(() => {
      result.current.confirmPending();
    });

    expect(dispatchSpy).toHaveBeenCalledWith(setContainerFilePath("/dir/book2.zip"));
    expect(result.current.pending).toBeNull();
  });

  it("cancels a pending confirmation without opening", async () => {
    mockedResolve.mockResolvedValue({ filePath: "/dir/book2.zip", displayName: "Book 2" });
    const { result, dispatchSpy } = renderTrigger(buildState("ask"));

    await act(async () => {
      result.current.onForwardBoundary();
    });
    act(() => {
      result.current.cancelPending();
    });

    expect(result.current.pending).toBeNull();
    expect(dispatchSpy).not.toHaveBeenCalledWith(setContainerFilePath("/dir/book2.zip"));
  });

  it("guards against concurrent triggers while resolving", async () => {
    // Never resolves, so the first call keeps the in-progress guard active.
    mockedResolve.mockReturnValue(new Promise(() => {}));
    const { result } = renderTrigger(buildState("auto"));

    await act(async () => {
      result.current.onForwardBoundary();
      result.current.onForwardBoundary();
    });

    expect(mockedResolve).toHaveBeenCalledTimes(1);
  });
});
