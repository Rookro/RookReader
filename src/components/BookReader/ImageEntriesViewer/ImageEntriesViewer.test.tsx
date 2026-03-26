import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import ImageEntriesViewer from "./ImageEntriesViewer";
import * as ReadReducer from "../../../reducers/ReadReducer";
import { error } from "@tauri-apps/plugin-log";
import { mockScrollToRow } from "../../../test/mocks/components";

// Mock SidePanelHeader
vi.mock("../../SidePane/SidePanelHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="side-panel-header">{title}</div>,
}));

// Mock actions
vi.mock("../../../reducers/ReadReducer", async () => {
  const actual = await vi.importActual("../../../reducers/ReadReducer");
  return {
    ...actual,
    setImageIndex: vi.fn((payload: number) => ({ type: "read/setImageIndex", payload })),
  };
});

describe("ImageEntriesViewer", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render SidePanelHeader", () => {
    renderWithProviders(<ImageEntriesViewer />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByTestId("side-panel-header")).toBeInTheDocument();
  });

  it("should show 'no pages' message when entries is empty", () => {
    renderWithProviders(<ImageEntriesViewer />, { preloadedState: createBasePreloadedState() });
    expect(screen.getByText("No pages.")).toBeInTheDocument();
  });

  it("should render list items when entries are present", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.entries = ["p1.jpg", "p2.jpg"];

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });
    expect(screen.getByText("p1.jpg")).toBeInTheDocument();
    expect(screen.getByText("p2.jpg")).toBeInTheDocument();
  });

  it("should dispatch setImageIndex when an item is clicked", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.entries = ["p1.jpg", "p2.jpg"];

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });

    // The mock renders all items
    const rowButton = screen.getAllByRole("button")[1]; // Click second item
    await user.click(rowButton);

    expect(ReadReducer.setImageIndex).toHaveBeenCalledWith(1);
  });

  it("should scroll to row when index changes", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.entries = ["p1.jpg", "p2.jpg", "p3.jpg"];
    preloadedState.read.containerFile.index = 2;

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });

    await waitFor(() => {
      expect(mockScrollToRow).toHaveBeenCalledWith({
        align: "smart",
        behavior: "instant",
        index: 2,
      });
    });
  });

  it("should log error if scrollToRow fails", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.entries = ["p1.jpg"];
    preloadedState.read.containerFile.index = 0;

    mockScrollToRow.mockImplementationOnce(() => {
      throw new Error("Scroll failed");
    });

    renderWithProviders(<ImageEntriesViewer />, { preloadedState });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to scroll to row 0"));
    });
  });
});
