import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/utils";
import AboutPage from "./AboutPage";

describe("AboutPage", () => {
  it("should render project information and license sections", async () => {
    renderWithProviders(<AboutPage />);

    await waitFor(() => {
      // The word "About" might be in the tab or elsewhere, but we can check app name
      expect(screen.getByText(/Project Page/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Third-Party Licenses/i)).toBeInTheDocument();
  });
});
