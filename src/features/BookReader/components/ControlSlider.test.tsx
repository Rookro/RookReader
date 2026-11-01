import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import ControlSlider from "./ControlSlider";

describe("ControlSlider", () => {
  it("should render correct index and total entries", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = ["image1.jpg", "image2.jpg", "image3.jpg"];
    preloadedState.reader.index = 1;
    preloadedState.reader.history = [];
    preloadedState.reader.historyIndex = -1;

    renderWithProviders(<ControlSlider />, { preloadedState });

    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("should display 0/0 and disable slider when entries are empty", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = [];
    preloadedState.reader.index = 0;
    preloadedState.reader.history = [];
    preloadedState.reader.historyIndex = -1;

    renderWithProviders(<ControlSlider />, { preloadedState });

    expect(screen.getByText("0/0")).toBeInTheDocument();
    const slider = screen.getByRole("slider");
    // MUI Slider becomes disabled when no entries
    expect(slider).toBeDisabled();
  });

  it("should dispatch setImageIndex when slider value changes", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.entries = ["1.jpg", "2.jpg", "3.jpg"];
    preloadedState.reader.index = 0;
    preloadedState.reader.history = [];
    preloadedState.reader.historyIndex = -1;

    const { store } = renderWithProviders(<ControlSlider />, { preloadedState });

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: 2 } });

    expect(store.getState().reader.index).toBe(2);
  });

  // The emotion cache key ("muirtl"/"muiltr") prefixes every class name it emits, so the
  // rendered direction is readable from the slider's class list.
  it.each([
    ["rtl", /muirtl-/],
    ["ltr", /muiltr-/],
  ])(
    "should render the slider %s for a novel, ignoring the comic setting",
    (direction, expected) => {
      const preloadedState = createBasePreloadedState();
      preloadedState.reader.entries = ["1.jpg", "2.jpg"];
      preloadedState.reader.isNovel = true;
      preloadedState.reader.novelDirection = direction as "rtl" | "ltr";
      preloadedState.settings.reader.comic.readingDirection = direction === "rtl" ? "ltr" : "rtl";

      renderWithProviders(<ControlSlider />, { preloadedState });

      expect(screen.getByTestId("control-slider").className).toMatch(expected);
    },
  );
});
