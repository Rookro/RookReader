import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
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
