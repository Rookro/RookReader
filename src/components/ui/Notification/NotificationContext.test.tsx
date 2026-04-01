import { describe, it, expect, vi } from "vitest";
import { screen, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationProvider, { useNotification } from "./NotificationContext";
import { renderWithProviders } from "../../../test/utils";
import { AlertColor } from "@mui/material";

// Helper component to test useNotification
const TestComponent = ({ message, severity }: { message: string; severity?: AlertColor }) => {
  const { showNotification } = useNotification();
  return <button onClick={() => showNotification(message, severity)}>Show Notification</button>;
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

    // Verify Alert severity class (MUI adds 'MuiAlert-filledSuccess' or similar)
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("MuiAlert-filledSuccess");
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
    await vi.waitFor(() => {
      expect(screen.queryByText("Close Me")).not.toBeInTheDocument();
    });
  });
});
