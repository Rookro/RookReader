import { describe, it, expect } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import ControlSlider from "./ControlSlider";

describe("ControlSlider", () => {
  it("should render correct index and total entries", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.entries = ["image1.jpg", "image2.jpg", "image3.jpg"];
    preloadedState.read.containerFile.index = 1;
    preloadedState.read.containerFile.history = [];
    preloadedState.read.containerFile.historyIndex = -1;

    renderWithProviders(<ControlSlider />, { preloadedState });

    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("should display 0/0 and disable slider when entries are empty", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.entries = [];
    preloadedState.read.containerFile.index = 0;
    preloadedState.read.containerFile.history = [];
    preloadedState.read.containerFile.historyIndex = -1;

    renderWithProviders(<ControlSlider />, { preloadedState });

    expect(screen.getByText("0/0")).toBeInTheDocument();
    const slider = screen.getByRole("slider");
    // MUI Slider becomes disabled when no entries
    expect(slider).toBeDisabled();
  });

  it("should dispatch setImageIndex when slider value changes", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.read.containerFile.entries = ["1.jpg", "2.jpg", "3.jpg"];
    preloadedState.read.containerFile.index = 0;
    preloadedState.read.containerFile.history = [];
    preloadedState.read.containerFile.historyIndex = -1;

    const { store } = renderWithProviders(<ControlSlider />, { preloadedState });

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: 2 } });

    expect(store.getState().read.containerFile.index).toBe(2);
  });
});
