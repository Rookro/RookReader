import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { createBasePreloadedState, renderWithProviders } from "../../test/utils";
import GlobalErrorListener from "./GlobalErrorListener";
import { ErrorCode } from "../../types/Error";
import * as notificationContext from "./Notification/NotificationContext";

// Mock useNotification
vi.mock("./Notification/NotificationContext", () => ({
  useNotification: vi.fn(),
}));

describe("GlobalErrorListener", () => {
  const showNotificationMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationContext.useNotification).mockReturnValue({
      showNotification: showNotificationMock,
    });
  });

  it("should trigger notification and clear error when containerFile has error", async () => {
    const preloadedState = structuredClone(createBasePreloadedState());
    preloadedState.read.containerFile.error = {
      code: ErrorCode.CONTAINER_UNSUPPORTED_CONTAINER_ERROR,
    };

    const { store } = renderWithProviders(<GlobalErrorListener />, { preloadedState });

    await waitFor(() => {
      // "Failed to open book. Unsupported format."
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.stringContaining("Failed to open book."),
        "error",
      );
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.stringContaining("Unsupported format."),
        "error",
      );
    });

    // Check if error is cleared in Redux
    await waitFor(() => {
      expect(store.getState().read.containerFile.error).toBeNull();
    });
  });

  it("should trigger notification and clear error when explorer has error", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.explorer.error = { code: ErrorCode.IO_ERROR };

    const { store } = renderWithProviders(<GlobalErrorListener />, { preloadedState });

    await waitFor(() => {
      // "Failed to load folder contents."
      expect(showNotificationMock).toHaveBeenCalledWith("Failed to load folder contents.", "error");
    });

    await waitFor(() => {
      expect(store.getState().read.explorer.error).toBeNull();
    });
  });

  it("should trigger notification and clear error when history has error", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.history.error = { code: ErrorCode.OTHER_ERROR };

    const { store } = renderWithProviders(<GlobalErrorListener />, { preloadedState });

    await waitFor(() => {
      // "Failed to load history."
      expect(showNotificationMock).toHaveBeenCalledWith("Failed to load history.", "error");
    });

    await waitFor(() => {
      expect(store.getState().history.error).toBeNull();
    });
  });

  it("should trigger notification and clear error when bookshelf has error", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.bookCollection.bookshelf.error = { code: ErrorCode.OTHER_ERROR };

    const { store } = renderWithProviders(<GlobalErrorListener />, { preloadedState });

    await waitFor(() => {
      // "Bookshelf operation failed."
      expect(showNotificationMock).toHaveBeenCalledWith("Bookshelf operation failed.", "error");
    });

    await waitFor(() => {
      expect(store.getState().bookCollection.bookshelf.error).toBeNull();
    });
  });

  it("should trigger notification and clear error when tags has error", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.bookCollection.tag.error = { code: ErrorCode.OTHER_ERROR };

    const { store } = renderWithProviders(<GlobalErrorListener />, { preloadedState });

    await waitFor(() => {
      // "Tag operation failed."
      expect(showNotificationMock).toHaveBeenCalledWith("Tag operation failed.", "error");
    });

    await waitFor(() => {
      expect(store.getState().bookCollection.tag.error).toBeNull();
    });
  });
});
