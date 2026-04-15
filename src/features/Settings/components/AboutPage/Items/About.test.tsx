import { getName, getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/utils";
import About from "./About";

describe("About", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render app name and version correctly", async () => {
    vi.mocked(getName).mockResolvedValue("Test Reader");
    vi.mocked(getVersion).mockResolvedValue("2.0.0");

    renderWithProviders(<About />);

    await waitFor(() => {
      expect(screen.getByText("Test Reader")).toBeInTheDocument();
      expect(screen.getByText(/version 2.0.0/i)).toBeInTheDocument();
    });
  });

  it("should open project page when link is clicked", async () => {
    renderWithProviders(<About />);

    await waitFor(() => expect(screen.getByText("Project Page")).toBeInTheDocument());

    const projectLink = screen.getByText("Project Page").closest("button");
    if (projectLink) {
      await user.click(projectLink);
    }

    expect(openUrl).toHaveBeenCalledWith("https://github.com/Rookro/RookReader");
  });
});
