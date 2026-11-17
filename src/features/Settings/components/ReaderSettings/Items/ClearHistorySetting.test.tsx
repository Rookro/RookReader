import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../../../bindings/api";
import {
  createBasePreloadedState,
  mockSettingsCommands,
  renderWithProviders,
} from "../../../../../test/utils";
import { CommandError, ErrorCode } from "../../../../../types/Error";
import ClearHistorySetting from "./ClearHistorySetting";

describe("ClearHistorySetting", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("is enabled while reading history is off", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.history.recordReadingHistory = false;
    renderWithProviders(<ClearHistorySetting />, { preloadedState });

    expect(screen.getByRole("button", { name: "Clear all" })).toBeEnabled();
  });

  it("clears all history after the confirmation and says so", async () => {
    renderWithProviders(<ClearHistorySetting />);

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    const dialog = screen.getByRole("dialog", { name: "Clear all reading history?" });
    await user.click(within(dialog).getByRole("button", { name: "Clear all" }));

    await waitFor(() => expect(api.clearAllReadingHistory).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Reading history cleared.")).toBeInTheDocument();
  });

  it("clears nothing when the confirmation is cancelled", async () => {
    renderWithProviders(<ClearHistorySetting />);

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.clearAllReadingHistory).not.toHaveBeenCalled();
  });

  it("does not say it cleared when clearing failed", async () => {
    vi.mocked(api.clearAllReadingHistory).mockRejectedValueOnce(
      new CommandError(ErrorCode.database, "db"),
    );
    renderWithProviders(<ClearHistorySetting />);

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    const dialog = screen.getByRole("dialog", { name: "Clear all reading history?" });
    await user.click(within(dialog).getByRole("button", { name: "Clear all" }));

    await waitFor(() => expect(api.clearAllReadingHistory).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Reading history cleared.")).not.toBeInTheDocument();
  });
});
