import { combineReducers } from "@reduxjs/toolkit";
import BookmarkReducer from "../features/BookReader/bookmarkSlice";
import FileNavigatorReducer from "../features/BookReader/fileNavigatorSlice";
import ReaderReducer from "../features/BookReader/slice";
import SeriesReducer from "../features/Bookshelf/seriesSlice";
import CollectionReducer from "../features/Bookshelf/slice";
import TagReducer from "../features/Bookshelf/tagSlice";
import HistoryReducer from "../features/History/slice";
import ViewReducer from "../features/MainView/slice";
import SettingsErrorReducer from "../features/Settings/errorSlice";
import SettingsReducer from "../features/Settings/slice";

export const rootReducer = combineReducers({
  reader: ReaderReducer,
  fileNavigator: FileNavigatorReducer,
  bookmark: BookmarkReducer,
  view: ViewReducer,
  history: HistoryReducer,
  collection: CollectionReducer,
  tag: TagReducer,
  series: SeriesReducer,
  settings: SettingsReducer,
  settingsError: SettingsErrorReducer,
});
