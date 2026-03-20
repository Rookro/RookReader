import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/utils";
import SettingsView from "./SettingsView";

describe("SettingsView", () => {
  const user = userEvent.setup();

  it("should render all tabs", () => {
    renderWithProviders(<SettingsView />);

    expect(screen.getByRole("tab", { name: /General/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Startup/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Page/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /File Navigator/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /History/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Rendering/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Novel Reader/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Developer/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /About/i })).toBeInTheDocument();
  });

  it("should switch content when a tab is clicked", async () => {
    renderWithProviders(<SettingsView />);

    // Initially showing General settings
    expect(screen.getByText(/General Settings/i)).toBeInTheDocument();

    // Click on Startup tab
    const startupTab = screen.getByRole("tab", { name: /Startup/i });
    await user.click(startupTab);

    // Should now show Startup settings title
    expect(screen.getByText(/Startup Settings/i)).toBeInTheDocument();
  });
});
