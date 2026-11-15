import { error } from "@tauri-apps/plugin-log";
import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../../../bindings/api";
import { renderWithProviders } from "../../../test/utils";
import SettingsUnreadNotifier from "./SettingsUnreadNotifier";

describe("SettingsUnreadNotifier", () => {
  it("tells the reader that the settings file could not be read", async () => {
    vi.mocked(api.isSettingsUnread).mockResolvedValue(true);

    renderWithProviders(<SettingsUnreadNotifier />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The settings file could not be read when RookReader started");
    expect(alert).toHaveTextContent("reading history off");
    expect(alert).toHaveClass("MuiAlert-colorWarning");
  });

  it("says nothing when the settings file was read", async () => {
    vi.mocked(api.isSettingsUnread).mockResolvedValue(false);

    renderWithProviders(<SettingsUnreadNotifier />);
    await waitFor(() => expect(api.isSettingsUnread).toHaveBeenCalled());
    await act(async () => {});

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("logs a failed question and says nothing", async () => {
    vi.mocked(api.isSettingsUnread).mockRejectedValue(new Error("no answer"));

    renderWithProviders(<SettingsUnreadNotifier />);

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        "Failed to ask whether the settings file was read: Error: no answer",
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
