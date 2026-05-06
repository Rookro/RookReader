import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import UpdaterMessageDialog from "./UpdaterMessageDialog";

describe("UpdaterMessageDialog", () => {
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: mockWriteText,
      },
    });
  });

  it("should not render when open is false", () => {
    renderWithProviders(
      <UpdaterMessageDialog
        open={false}
        title="Test Title"
        message="Test Message"
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should render dialog content correctly", () => {
    renderWithProviders(
      <UpdaterMessageDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Message")).toBeInTheDocument();
  });

  it("should call onClose when Close button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(
      <UpdaterMessageDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onClose={handleClose}
      />,
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("should render error type correctly", () => {
    renderWithProviders(
      <UpdaterMessageDialog
        open={true}
        title="Error Title"
        message="Error Message"
        isError={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("ErrorOutlineIcon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("should copy message to clipboard and change button state when Copy button is clicked", async () => {
    renderWithProviders(
      <UpdaterMessageDialog
        open={true}
        title="Error Title"
        message="Error Message"
        isError={true}
        onClose={vi.fn()}
      />,
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });

    fireEvent.click(copyButton);

    expect(mockWriteText).toHaveBeenCalledWith("Error Message");
    expect(screen.getByText(/copied/i)).toBeInTheDocument();
    expect(screen.getByTestId("CheckIcon")).toBeInTheDocument();
  });

  it("should reset copy button state after timeout", async () => {
    vi.useFakeTimers();

    renderWithProviders(
      <UpdaterMessageDialog
        open={true}
        title="Error Title"
        message="Error Message"
        isError={true}
        onClose={vi.fn()}
      />,
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });

    fireEvent.click(copyButton);

    expect(mockWriteText).toHaveBeenCalledWith("Error Message");
    expect(screen.getByText(/copied/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();
    expect(screen.getByText(/copy/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("should clear existing timer if Copy is clicked again", async () => {
    vi.useFakeTimers();

    renderWithProviders(
      <UpdaterMessageDialog
        open={true}
        title="Error Title"
        message="Error Message"
        isError={true}
        onClose={vi.fn()}
      />,
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });

    fireEvent.click(copyButton);
    expect(screen.getByText(/copied/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Click again
    fireEvent.click(copyButton);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Should still be "copied" because timer was reset to another 5s
    expect(screen.getByText(/copied/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("should clear timer on unmount", async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(global, "clearTimeout");

    const { unmount } = renderWithProviders(
      <UpdaterMessageDialog
        open={true}
        title="Error Title"
        message="Error Message"
        isError={true}
        onClose={vi.fn()}
      />,
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyButton);

    unmount();

    expect(spy).toHaveBeenCalled();

    vi.useRealTimers();
    spy.mockRestore();
  });
});
