import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, RootState } from "../../test/utils";
import MainContent from "./MainContent";
import { mockStore } from "../../test/mocks/tauri";
import { JSX } from "react";
import { Theme } from "@mui/material/styles";
import { SxProps } from "@mui/material";

// Mock lazy-loaded components to avoid issues in tests
vi.mock("../BookReader/BookReader", () => {
  const BookReader = ({ sx }: { sx: SxProps<Theme> }): JSX.Element => (
    <div data-testid="book-reader" style={sx as React.CSSProperties}>
      Book Reader
    </div>
  );
  BookReader.displayName = "BookReader";
  return { default: BookReader };
});

vi.mock("../Bookshelf/Bookshelf", () => {
  const Bookshelf = ({ sx }: { sx: SxProps<Theme> }): JSX.Element => (
    <div data-testid="bookshelf" style={sx as React.CSSProperties}>
      Bookshelf
    </div>
  );
  Bookshelf.displayName = "Bookshelf";
  return { default: Bookshelf };
});

describe("MainContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize activeView from settingsStore on mount", async () => {
    mockStore.get.mockResolvedValueOnce("reader");

    const { store } = renderWithProviders(<MainContent />);

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalledWith("initial-view");
    });

    await waitFor(() => {
      expect(store.getState().view.activeView).toBe("reader");
    });
  });

  it("should show Bookshelf and hide BookReader when activeView is 'bookshelf'", () => {
    const preloadedState = {
      view: { activeView: "bookshelf" as const },
    } as unknown as RootState;

    renderWithProviders(<MainContent />, { preloadedState });

    const bookshelf = screen.getByTestId("bookshelf");
    const bookReader = screen.getByTestId("book-reader");

    expect(bookshelf).not.toHaveStyle("display: none");
    expect(bookReader).toHaveStyle("display: none");
  });

  it("should show BookReader and hide Bookshelf when activeView is 'reader'", () => {
    const preloadedState = {
      view: { activeView: "reader" as const },
    } as unknown as RootState;

    renderWithProviders(<MainContent />, { preloadedState });

    const bookshelf = screen.getByTestId("bookshelf");
    const bookReader = screen.getByTestId("book-reader");

    expect(bookshelf).toHaveStyle("display: none");
    expect(bookReader).not.toHaveStyle("display: none");
  });

  it("should not dispatch setActiveView if initial-view is invalid", async () => {
    mockStore.get.mockResolvedValueOnce("invalid-view");

    // Explicitly set preloadedState to ensure we know the starting point
    const preloadedState = {
      view: { activeView: "bookshelf" as const },
    } as unknown as RootState;

    const { store } = renderWithProviders(<MainContent />, { preloadedState });

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalledWith("initial-view");
    });

    // Default state for activeView should remain "bookshelf"
    expect(store.getState().view.activeView).toBe("bookshelf");
  });
});
