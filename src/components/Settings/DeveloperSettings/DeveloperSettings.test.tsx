import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/utils";
import DeveloperSettings from "./DeveloperSettings";

describe("DeveloperSettings", () => {
  it("should render log and experimental features sections", async () => {
    renderWithProviders(<DeveloperSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Log Directory/i)).toBeInTheDocument();
    });

    // "Log Level" might appear in primary text and description
    expect(screen.getAllByText(/Log Level/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Experimental Features/i)).toBeInTheDocument();
  });
});
