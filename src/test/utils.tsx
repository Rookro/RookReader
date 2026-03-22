import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { ThemeProvider, createTheme } from "@mui/material";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import translationEnUs from "../i18n/locales/en-US.json";
import translationJaJp from "../i18n/locales/ja-JP.json";
import bookCollectionReducer from "../reducers/BookCollectionReducer";
import historyReducer from "../reducers/HistoryReducer";
import readReducer from "../reducers/ReadReducer";
import sidePaneReducer from "../reducers/SidePaneReducer";
import viewReducer from "../reducers/ViewReducer";
import settingsReducer from "../reducers/SettingsReducer";

// Create a lightweight i18n instance for testing with actual resources
export const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: "en-US",
  fallbackLng: "en-US",
  ns: ["translation"],
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  resources: {
    "en-US": { translation: translationEnUs },
    "ja-JP": { translation: translationJaJp },
  },
});

const rootReducer = combineReducers({
  bookCollection: bookCollectionReducer,
  history: historyReducer,
  read: readReducer,
  sidePane: sidePaneReducer,
  view: viewReducer,
  settings: settingsReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof createTestStore>;

interface ExtendedRenderOptions extends Omit<RenderOptions, "queries"> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
}

export function createBasePreloadedState(): RootState {
  return {
    settings: {
      "font-family": "Inter",
      direction: "ltr",
      "enable-directory-watch": false,
      "experimental-features": {},
      "first-page-single-view": true,
      history: { enable: true, "restore-last-container-on-startup": false },
      "home-directory": "",
      log: { level: "Info" },
      "novel-reader": { font: "default-font", "font-size": 16 },
      rendering: {
        "enable-preview": true,
        "max-image-height": 0,
        "image-resize-method": "lanczos3",
        "pdf-rendering-height": 2000,
      },
      "sort-order": "NAME_ASC",
      theme: "system",
      "two-paged": true,
      "bookshelf-sort-order": "NAME_ASC",
      "bookshelf-grid-size": 1,
      "initial-view": "reader",
    },
    view: {
      activeView: "reader",
    },
    read: {
      containerFile: {
        history: [],
        historyIndex: -1,
        entries: [],
        index: 0,
        isNovel: false,
        isLoading: false,
        isDirectory: false,
        book: null,
        cfi: null,
        error: null,
      },
      explorer: {
        history: [],
        historyIndex: -1,
        entries: [],
        searchText: "",
        isLoading: false,
        error: null,
      },
    },
    sidePane: {
      left: { isHidden: false, tabIndex: 0 },
    },
    bookCollection: {
      bookshelf: { bookshelves: [], selectedId: null, books: [], status: "idle", error: null },
      tag: { tags: [], selectedId: null, status: "idle", error: null },
      series: { series: [], selectedId: null, books: [], status: "idle", error: null },
      searchText: "",
    },
    history: { recentlyReadBooks: [], status: "idle", error: null },
  };
}

export function createTestStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  });
}

const theme = createTheme();

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState = {},
    store = createTestStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }): ReactElement {
    return (
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
        </ThemeProvider>
      </Provider>
    );
  }
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
