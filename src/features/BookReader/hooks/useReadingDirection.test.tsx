import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { createBasePreloadedState, createTestStore, type RootState } from "../../../test/utils";
import { NOVEL_FALLBACK_DIRECTION, useReadingDirection } from "./useReadingDirection";

const renderDirection = (state: RootState) => {
  const store = createTestStore(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook(() => useReadingDirection(), { wrapper }).result;
};

describe("useReadingDirection", () => {
  it.each([
    "rtl",
    "ltr",
  ] as const)("should follow the comic setting (%s) for a comic", (direction) => {
    const state = createBasePreloadedState();
    state.read.containerFile.isNovel = false;
    state.settings.reader.comic.readingDirection = direction;

    expect(renderDirection(state).current).toBe(direction);
  });

  it.each([
    "rtl",
    "ltr",
  ] as const)("should follow the novel's detected direction (%s) over the comic setting", (direction) => {
    const state = createBasePreloadedState();
    state.read.containerFile.isNovel = true;
    state.read.containerFile.novelDirection = direction;
    state.settings.reader.comic.readingDirection = direction === "rtl" ? "ltr" : "rtl";

    expect(renderDirection(state).current).toBe(direction);
  });

  it("should fall back for a novel whose writing mode is not detected yet", () => {
    const state = createBasePreloadedState();
    state.read.containerFile.isNovel = true;
    state.read.containerFile.novelDirection = null;
    state.settings.reader.comic.readingDirection = "ltr";

    expect(renderDirection(state).current).toBe(NOVEL_FALLBACK_DIRECTION);
  });
});
