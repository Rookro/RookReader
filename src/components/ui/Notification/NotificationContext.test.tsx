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
      <button type="button" onClick={() => showNotification("Second", "warning")}>
        second
      </button>
    </>
  );
};

// One button queueing an information notification and an error together.
const InfoThenError = () => {
  const { showNotification } = useNotification();
  return (
    <button
      type="button"
      onClick={() => {
        showNotification("Info");
        showNotification("Error", "error");
      }}
    >
      both
    </button>
  );
};

const PersistentNotification = () => {
  const { showNotification } = useNotification();
  return (
    <button type="button" onClick={() => showNotification("Stay", "warning", { persist: true })}>
      show
    </button>
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

  it("keeps a persistent notification until it is closed", () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <NotificationProvider>
          <PersistentNotification />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "show" }));
      // Well past the auto-hide delay, then the exit transition.
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText("Stay")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText(/close/i));
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByText("Stay")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes a notification on Escape", async () => {
    renderWithProviders(
      <NotificationProvider>
        <TestComponent message="Escape Me" />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole("button"));
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("Escape Me")).not.toBeInTheDocument();
    });
  });

  it("does not close a persistent notification on Escape", () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <NotificationProvider>
          <PersistentNotification />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "show" }));
      fireEvent.keyDown(document, { key: "Escape" });
      // Past the exit transition it would start.
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText("Stay")).toBeInTheDocument();
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

  it("does not queue a notification that is already waiting", async () => {
    renderWithProviders(
      <NotificationProvider>
        <TwoNotifications />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "first" }));
    await user.click(screen.getByRole("button", { name: "second" }));
    await user.click(screen.getByRole("button", { name: "second" }));
    await user.click(screen.getByLabelText(/close/i));
    expect(await screen.findByText("Second")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/close/i));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("queues the same message with another severity", async () => {
    renderWithProviders(
      <NotificationProvider>
        <TestComponent message="Same" severity="info" />
        <TestComponent message="Same" severity="warning" />
      </NotificationProvider>,
    );

    const [showInfo, showWarning] = screen.getAllByRole("button");
    await user.click(showInfo);
    await user.click(showWarning);
    expect(screen.getByRole("alert")).toHaveClass("MuiAlert-colorInfo");

    await user.click(screen.getByLabelText(/close/i));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveClass("MuiAlert-colorWarning");
    });
    expect(screen.getByText("Same")).toBeInTheDocument();
  });

  it("closes an information notification on screen when an error is requested", () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <NotificationProvider>
          <TestComponent message="Info" />
          <TestComponent message="Error" severity="error" />
        </NotificationProvider>,
      );

      const [showInfo, showError] = screen.getAllByRole("button");
      fireEvent.click(showInfo);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      fireEvent.click(showError);
      // Well short of the auto-hide delay: only the exit transition.
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByText("Info")).not.toBeInTheDocument();
      expect(screen.getByText("Error")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops the information notifications waiting when an error is requested", () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <NotificationProvider>
          <TestComponent message="On screen" />
          <TestComponent message="Waiting" />
          <TestComponent message="Error" severity="error" />
        </NotificationProvider>,
      );

      const [showOnScreen, showWaiting, showError] = screen.getAllByRole("button");
      fireEvent.click(showOnScreen);
      fireEvent.click(showWaiting);
      fireEvent.click(showError);
      // In small steps, so that the waiting one is caught even if it is shown only briefly.
      for (let elapsed = 0; elapsed < 1000; elapsed += 50) {
        act(() => {
          vi.advanceTimersByTime(50);
        });
        expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
      }
      expect(screen.queryByText("On screen")).not.toBeInTheDocument();
      expect(screen.getByText("Error")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText(/close/i));
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops an information notification waiting behind a warning when an error is requested", () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <NotificationProvider>
          <TestComponent message="Warning" severity="warning" />
          <TestComponent message="Waiting" />
          <TestComponent message="Error" severity="error" />
        </NotificationProvider>,
      );

      const [showWarning, showWaiting, showError] = screen.getAllByRole("button");
      fireEvent.click(showWarning);
      fireEvent.click(showWaiting);
      fireEvent.click(showError);
      act(() => {
        vi.advanceTimersByTime(4900);
      });
      expect(screen.getByText("Warning")).toBeInTheDocument();

      // In small steps through the warning's exit, to catch even a brief showing.
      for (let elapsed = 0; elapsed < 1100; elapsed += 50) {
        act(() => {
          vi.advanceTimersByTime(50);
        });
        expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
      }
      expect(screen.getByText("Error")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an error requested together with an information notification", () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <NotificationProvider>
          <InfoThenError />
        </NotificationProvider>,
      );

      fireEvent.click(screen.getByRole("button"));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByText("Info")).not.toBeInTheDocument();
      expect(screen.getByText("Error")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText(/close/i));
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an information notification requested after an error", async () => {
    renderWithProviders(
      <NotificationProvider>
        <TestComponent message="Error" severity="error" />
        <TestComponent message="Info" />
      </NotificationProvider>,
    );

    const [showError, showInfo] = screen.getAllByRole("button");
    await user.click(showError);
    await user.click(showInfo);
    expect(screen.getByText("Error")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/close/i));

    expect(await screen.findByText("Info")).toBeInTheDocument();
  });

  it("keeps the information notifications waiting when an error is repeated", async () => {
    renderWithProviders(
      <NotificationProvider>
        <TestComponent message="Error" severity="error" />
        <TestComponent message="Info" />
      </NotificationProvider>,
    );

    const [showError, showInfo] = screen.getAllByRole("button");
    await user.click(showError);
    await user.click(showInfo);
    await user.click(showError);

    await user.click(screen.getByLabelText(/close/i));

    expect(await screen.findByText("Info")).toBeInTheDocument();
  });

  it("does not close a warning on screen when an error is requested", () => {
    vi.useFakeTimers();
    try {
      renderWithProviders(
        <NotificationProvider>
          <TestComponent message="Warning" severity="warning" />
          <TestComponent message="Error" severity="error" />
        </NotificationProvider>,
      );

      const [showWarning, showError] = screen.getAllByRole("button");
      fireEvent.click(showWarning);
      fireEvent.click(showError);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText("Warning")).toBeInTheDocument();
      expect(screen.queryByText("Error")).not.toBeInTheDocument();

      // The rest of the auto-hide delay, then the exit transition.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByText("Warning")).not.toBeInTheDocument();
      expect(screen.getByText("Error")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
