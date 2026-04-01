import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../../test/utils";
import ThirdParty from "./ThirdParty";
import { openPath } from "@tauri-apps/plugin-opener";
import { resolveResource } from "@tauri-apps/api/path";

describe("ThirdParty", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render license buttons", () => {
    renderWithProviders(<ThirdParty />);

    expect(screen.getByText(/Third-Party Licenses/i)).toBeInTheDocument();
    expect(screen.getByText(/Frontend Licenses/i)).toBeInTheDocument();
    expect(screen.getByText(/Backend Licenses/i)).toBeInTheDocument();
    expect(screen.getByText(/PDFium License/i)).toBeInTheDocument();
  });

  it("should open license files when buttons are clicked", async () => {
    vi.mocked(resolveResource).mockImplementation((path) =>
      Promise.resolve(`/mock/resource/${path}`),
    );

    renderWithProviders(<ThirdParty />);

    // Frontend
    await user.click(screen.getByText(/Frontend Licenses/i));
    await waitFor(() => {
      expect(resolveResource).toHaveBeenCalledWith("licenses/frontend-licenses.txt");
      expect(openPath).toHaveBeenCalledWith("/mock/resource/licenses/frontend-licenses.txt");
    });

    // Backend
    await user.click(screen.getByText(/Backend Licenses/i));
    await waitFor(() => {
      expect(resolveResource).toHaveBeenCalledWith("licenses/backend-licenses.html");
      expect(openPath).toHaveBeenCalledWith("/mock/resource/licenses/backend-licenses.html");
    });

    // PDFium
    await user.click(screen.getByText(/PDFium License/i));
    await waitFor(() => {
      expect(resolveResource).toHaveBeenCalledWith("licenses/pdfium/");
      expect(openPath).toHaveBeenCalledWith("/mock/resource/licenses/pdfium/");
    });
  });
});
