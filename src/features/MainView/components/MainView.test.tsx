import type { SxProps } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { screen } from "@testing-library/react";
import type { JSX } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import MainContent from "./MainView";

// Mock lazy-loaded components to avoid issues in tests
vi.mock("../../BookReader/components/BookReader", () => {
  const BookReader = ({ sx }: { sx: SxProps<Theme> }): JSX.Element => (
    <div data-testid="book-reader" style={sx as React.CSSProperties}>
      Book Reader
    </div>
  );
  BookReader.displayName = "BookReader";
  return { default: BookReader };
});

vi.mock("../../Bookshelf/components/Bookshelf", () => {
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

  it("should show Bookshelf and hide BookReader when activeView is 'bookshelf'", async () => {
    const preloadedState = structuredClone(createBasePreloadedState());
    preloadedState.view.activeView = "bookshelf" as const;

    renderWithProviders(<MainContent />, { preloadedState });

    const bookshelf = await screen.findByTestId("bookshelf");
    const bookReader = await screen.findByTestId("book-reader");

    expect(bookshelf).not.toHaveStyle("display: none");
    expect(bookReader).toHaveStyle("display: none");
  });

  it("should show BookReader and hide Bookshelf when activeView is 'reader'", async () => {
    const preloadedState = structuredClone(createBasePreloadedState());
    preloadedState.view.activeView = "reader" as const;

    renderWithProviders(<MainContent />, { preloadedState });

    const bookshelf = await screen.findByTestId("bookshelf");
    const bookReader = await screen.findByTestId("book-reader");

    expect(bookshelf).toHaveStyle("display: none");
    expect(bookReader).not.toHaveStyle("display: none");
  });
});
