import { createTheme, ThemeProvider } from "@mui/material";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { type RenderOptions, render } from "@testing-library/react";
import i18n from "i18next";
import type React from "react";
import type { ReactElement } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { Provider } from "react-redux";
import readReducer from "../features/BookReader/slice";
import bookCollectionReducer from "../features/Bookshelf/slice";
import historyReducer from "../features/History/slice";
import viewReducer from "../features/MainView/slice";
import { defaultSettings } from "../features/Settings/settingsStore";
import settingsReducer from "../features/Settings/slice";
import sidePaneReducer from "../features/SidePane/slice";
import translationEnUs from "../i18n/locales/en-US.json";
import translationJaJp from "../i18n/locales/ja-JP.json";

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
    settings: structuredClone(defaultSettings),
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
