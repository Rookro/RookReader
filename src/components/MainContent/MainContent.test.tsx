import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { createBasePreloadedState, renderWithProviders } from "../../test/utils";
import MainContent from "./MainContent";
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
  const basePreloadedState = createBasePreloadedState();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show Bookshelf and hide BookReader when activeView is 'bookshelf'", async () => {
    const preloadedState = {
      ...basePreloadedState,
      view: { ...basePreloadedState.view, activeView: "bookshelf" as const },
    };

    renderWithProviders(<MainContent />, { preloadedState });

    const bookshelf = await screen.findByTestId("bookshelf");
    const bookReader = await screen.findByTestId("book-reader");

    expect(bookshelf).not.toHaveStyle("display: none");
    expect(bookReader).toHaveStyle("display: none");
  });

  it("should show BookReader and hide Bookshelf when activeView is 'reader'", async () => {
    const preloadedState = {
      ...basePreloadedState,
      view: { ...basePreloadedState.view, activeView: "reader" as const },
    };

    renderWithProviders(<MainContent />, { preloadedState });

    const bookshelf = await screen.findByTestId("bookshelf");
    const bookReader = await screen.findByTestId("book-reader");

    expect(bookshelf).toHaveStyle("display: none");
    expect(bookReader).not.toHaveStyle("display: none");
  });
});
