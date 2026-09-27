import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../../store/store";
import { buildGridItems } from "./utils/BookshelfUtils";

/** The items the book grid shows, rebuilt only when one of their inputs changes. */
export const selectGridItems = createSelector(
  [
    (state: RootState) => state.bookCollection.books,
    (state: RootState) => state.series.series,
    (state: RootState) => state.tag.selectedId,
    (state: RootState) => state.series.selectedId,
    (state: RootState) => state.bookCollection.searchText,
    (state: RootState) => state.settings.bookshelf.sortOrder,
  ],
  (books, allSeries, tagId, selectedSeriesId, searchText, sortOrder) =>
    buildGridItems({ books, allSeries, tagId, selectedSeriesId, searchText, sortOrder }),
);
