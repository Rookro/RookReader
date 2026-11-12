import type { AlertColor } from "@mui/material";
import { act, fireEvent, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import NotificationProvider, { useNotification } from "./NotificationContext";

// Helper component to test useNotification
const TestComponent = ({ message, severity }: { message: string; severity?: AlertColor }) => {
  const { showNotification } = useNotification();
  return (
    <button type="button" onClick={() => showNotification(message, severity)}>
      Show Notification
    </button>
  );
};

// Two buttons, each queueing its own notification.
const TwoNotifications = () => {
  const { showNotification } = useNotification();
  return (
    <>
      <button type="button" onClick={() => showNotification("First")}>
        first
      </button>
      <button type="button" onClick={() => showNotification("Second", "error")}>
        second
      </button>
    </>
  );
};

describe("NotificationContext", () => {
  const user = userEvent.setup();

  it("should render children", () => {
    renderWithProviders(
      <NotificationProvider>
        <div data-testid="child">Test Child</div>
      </NotificationProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("should throw error when useNotification is used outside NotificationProvider", () => {
    // Suppress console.error for this test as it's expected
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useNotification());
    }).toThrow("useNotification must be used within a NotificationProvider.");

    consoleSpy.mockRestore();
  });

  it("should show notification when showNotification is called", async () => {
    renderWithProviders(
      <NotificationProvider>
        <TestComponent message="Hello World" severity="success" />
      </NotificationProvider>,
    );

    const button = screen.getByRole("button");
    await user.click(button);

    // Verify notification message
    expect(screen.getByText("Hello World")).toBeInTheDocument();

    // Verify Alert variant and severity classes
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("MuiAlert-filled", "MuiAlert-colorSuccess");
  });

  it("should close notification when close button is clicked", async () => {
    renderWithProviders(
      <NotificationProvider>
        <TestComponent message="Close Me" />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Close Me")).toBeInTheDocument();

    // Find and click the close button inside the Alert
    const closeButton = screen.getByLabelText(/close/i);
    await user.click(closeButton);

    // Snackbar close usually has a transition, but the 'open' prop should change
    // In JSDOM/Testing Library, we check if it's eventually removed or hidden
    // Note: Snackbar might stay in DOM but with hidden visibility or exit transition.
    // The message is the easiest to track.

    // For MUI Snackbar, we can check if the element has been removed or is no longer visible
    // Depending on transition setup, it might take a moment.
    await waitFor(() => {
      expect(screen.queryByText("Close Me")).not.toBeInTheDocument();
    });
  });

  it("shows a later notification after the one on screen is closed", async () => {
    renderWithProviders(
      <NotificationProvider>
        <TwoNotifications />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "first" }));
    await user.click(screen.getByRole("button", { name: "second" }));
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.queryByText("Second")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/close/i));

    expect(await screen.findByText("Second")).toBeInTheDocument();
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });

  it("shows a later notification after the one on screen times out", () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <NotificationProvider>
          <TwoNotifications />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "first" }));
      fireEvent.click(screen.getByRole("button", { name: "second" }));
      expect(screen.getByText("First")).toBeInTheDocument();

      // The auto-hide delay, then the exit transition.
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByText("First")).not.toBeInTheDocument();
      expect(screen.getByText("Second")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not queue a notification that is already on screen", async () => {
    renderWithProviders(
      <NotificationProvider>
        <TwoNotifications />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "first" }));
    await user.click(screen.getByRole("button", { name: "first" }));
    await user.click(screen.getByLabelText(/close/i));

    await waitFor(() => {
      expect(screen.queryByText("First")).not.toBeInTheDocument();
    });
  });
});
