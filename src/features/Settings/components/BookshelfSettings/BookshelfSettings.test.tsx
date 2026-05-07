import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/utils";
import BookshelfSettings from "./BookshelfSettings";

// Mock child components to focus on BookshelfSettings rendering
vi.mock("./Items/EnableAutoScrollSetting", () => ({
  default: () => <div data-testid="enable-auto-scroll-setting" />,
}));

describe("BookshelfSettings", () => {
  it("should render the bookshelf settings panel with title", () => {
    renderWithProviders(<BookshelfSettings />);

    // Check if the title is rendered (using actual translated text from en-US.json)
    expect(screen.getByText("Bookshelf Settings")).toBeInTheDocument();

    // Check if the auto scroll setting item is present
    expect(screen.getByTestId("enable-auto-scroll-setting")).toBeInTheDocument();
  });
});
