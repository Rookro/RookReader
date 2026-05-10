import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/utils";
import SettingsView from "./SettingsView";

describe("SettingsView", () => {
  const user = userEvent.setup();

  it("should render all tabs", () => {
    renderWithProviders(<SettingsView />);

    expect(screen.getByRole("tab", { name: /General/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Bookshelf/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /File Navigator/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Reader/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Rendering/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Developer/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /About/i })).toBeInTheDocument();
  });

  it("should switch content when a tab is clicked", async () => {
    renderWithProviders(<SettingsView />);

    // Initially showing General settings
    expect(screen.getByText(/General Settings/i)).toBeInTheDocument();

    // Click on Developer tab
    const devTab = screen.getByRole("tab", { name: /Developer/i });
    await user.click(devTab);

    // Should now show Developer settings title
    expect(screen.getByText(/Developer Settings/i)).toBeInTheDocument();
  });
});
