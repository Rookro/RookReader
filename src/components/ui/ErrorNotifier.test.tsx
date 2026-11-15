import { act } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorReported } from "../../store/errorNotificationSlice";
import { createBasePreloadedState, renderWithProviders } from "../../test/utils";
import { ErrorCode } from "../../types/Error";
import type { ErrorContext } from "../../types/ErrorContext";
import ErrorNotifier from "./ErrorNotifier";
import * as notificationContext from "./Notification/NotificationContext";

// Mock useNotification; keep a passthrough provider so renderWithProviders can render it.
vi.mock("./Notification/NotificationContext", () => ({
  useNotification: vi.fn(),
  default: ({ children }: { children: ReactNode }) => children,
}));

describe("ErrorNotifier", () => {
  const showNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationContext.useNotification).mockReturnValue({ showNotification });
  });

  it("shows every pending error", () => {
    const { store } = renderWithProviders(<ErrorNotifier />, {
      preloadedState: {
        ...createBasePreloadedState(),
        errorNotification: {
          pending: [
            { context: "tag", code: ErrorCode.other },
            { context: "series", code: ErrorCode.other },
          ],
        },
      },
    });

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith(
      "Tag operation failed. (Error code: 90001)\nSeries operation failed. (Error code: 90001)",
      "error",
    );
    expect(store.getState().errorNotification.pending).toEqual([]);
  });

  it("shows a repeated error once", () => {
    renderWithProviders(<ErrorNotifier />, {
      preloadedState: {
        ...createBasePreloadedState(),
        errorNotification: {
          pending: [
            { context: "tag", code: ErrorCode.other },
            { context: "tag", code: ErrorCode.other },
          ],
        },
      },
    });

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith(
      "Tag operation failed. (Error code: 90001)",
      "error",
    );
  });

  it("shows nothing while the queue is empty", () => {
    renderWithProviders(<ErrorNotifier />);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it("shows an error reported after it mounted", () => {
    const { store } = renderWithProviders(<ErrorNotifier />);
    act(() => {
      store.dispatch(errorReported({ context: "bookmark", code: ErrorCode.database }));
    });
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it("does not show an error again once the queue is emptied", () => {
    const { store, rerender } = renderWithProviders(<ErrorNotifier />);
    act(() => {
      store.dispatch(errorReported({ context: "tag", code: ErrorCode.database }));
    });
    expect(store.getState().errorNotification.pending).toEqual([]);

    rerender(<ErrorNotifier />);

    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it.each<[ErrorContext, ErrorCode, string]>([
    ["open-container", ErrorCode.unsupportedContainer, "Failed to open book. Unsupported format."],
    [
      "open-container",
      ErrorCode.emptyContainer,
      "Failed to open book. The book contains no readable pages.",
    ],
    [
      "open-container",
      ErrorCode.pathNotFound,
      "Failed to open book. The file or folder was not found.",
    ],
    [
      "record-book",
      ErrorCode.database,
      "Failed to save the book's information. Saving data failed.",
    ],
    [
      "explorer",
      ErrorCode.io,
      "Failed to load folder contents. Reading or writing the file failed.",
    ],
    ["history", ErrorCode.other, "Failed to load history. (Error code: 90001)"],
    ["bookshelf", ErrorCode.other, "Bookshelf operation failed. (Error code: 90001)"],
    ["tag", ErrorCode.other, "Tag operation failed. (Error code: 90001)"],
    ["series", ErrorCode.other, "Series operation failed. (Error code: 90001)"],
    ["settings-save", ErrorCode.settings, "Failed to save settings. (Error code: 50001)"],
  ])("shows a %s error (%s) as %j", (context, code, message) => {
    renderWithProviders(<ErrorNotifier />, {
      preloadedState: {
        ...createBasePreloadedState(),
        errorNotification: { pending: [{ context, code }] },
      },
    });

    expect(showNotification).toHaveBeenCalledWith(message, "error");
  });
});
