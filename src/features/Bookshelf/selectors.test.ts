import { describe, expect, it } from "vitest";
import { rootReducer } from "../../store/rootReducer";
import { createMockBookWithState, createMockSeries } from "../../test/factories";
import { createBasePreloadedState } from "../../test/utils";
import { selectGridItems } from "./selectors";
import { setSearchText } from "./slice";
import { setSelectedTag } from "./tagSlice";

describe("selectGridItems", () => {
  const series = createMockSeries({ id: 10, name: "Series" });
  const volume = createMockBookWithState({ id: 1, display_name: "Vol 1", series_id: 10 });
  const standalone = createMockBookWithState({
    id: 2,
    display_name: "Standalone",
    series_id: null,
    tag_ids: [5],
  });

  const stateWithBooks = () => {
    const state = createBasePreloadedState();
    state.bookCollection.books = [volume, standalone];
    state.series.series = [series];
    return state;
  };

  it("builds the grid items from the store", () => {
    const items = selectGridItems(stateWithBooks());
    expect(items.map((item) => item.type)).toEqual(["series", "book"]);
  });

  it("returns the same array while its inputs are unchanged", () => {
    const state = stateWithBooks();
    const first = selectGridItems(state);

    // A change elsewhere in the store must not rebuild the items.
    const next = rootReducer(state, { type: "view/setActiveView", payload: "bookshelf" });
    expect(selectGridItems(next)).toBe(first);
  });

  it("rebuilds when the search text or the tag filter changes", () => {
    const state = stateWithBooks();
    const first = selectGridItems(state);

    const searched = rootReducer(state, setSearchText("stand"));
    expect(selectGridItems(searched)).not.toBe(first);
    expect(selectGridItems(searched).map((item) => item.type)).toEqual(["book"]);

    const tagged = rootReducer(state, setSelectedTag(5));
    expect(selectGridItems(tagged).map((item) => item.type)).toEqual(["book"]);
  });
});
