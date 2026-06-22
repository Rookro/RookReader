import { createTheme, ThemeProvider } from "@mui/material";
import { configureStore } from "@reduxjs/toolkit";
import { type RenderOptions, render } from "@testing-library/react";
import i18n from "i18next";
import type React from "react";
import type { ReactElement } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { Provider } from "react-redux";
import { defaultSettings } from "../features/Settings/settingsStore";
import translationEnUs from "../i18n/locales/en-US.json";
import translationJaJp from "../i18n/locales/ja-JP.json";
import { rootReducer } from "../store/rootReducer";
import type { AppSettings } from "../types/AppSettings";
import { mockTauri } from "./mocks/tauri";

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
        origin: null,
        pendingInitialPosition: null,
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
    bookCollection: {
      bookshelves: [],
      selectedId: null,
      books: [],
      status: "idle",
      error: null,
      searchText: "",
    },
    tag: { tags: [], selectedId: null, status: "idle", error: null },
    series: {
      series: [],
      selectedId: null,
      books: [],
      isEditSeriesOrderDialogOpen: false,
      editSeriesOrderTargetId: null,
      status: "idle",
      error: null,
    },
    history: { recentlyReadBooks: [], status: "idle", error: null },
    settingsError: { error: null },
  };
}

export function createTestStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  });
}

/** Recursively merges `patch` into a clone of `base` (mirrors the backend deep-merge). */
function deepMergeSettings<T>(base: T, patch: unknown): T {
  if (
    typeof base !== "object" ||
    base === null ||
    typeof patch !== "object" ||
    patch === null ||
    Array.isArray(patch)
  ) {
    return (patch as T) ?? base;
  }
  const result = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    result[key] = deepMergeSettings(result[key], value);
  }
  return result as T;
}

/**
 * Configures `invoke` so `get_settings`/`set_settings` behave like the backend in tests:
 * `get_settings` returns `base`, and `set_settings` deep-merges the patch into `base` and
 * returns the merged settings (which the slice then adopts). Other commands return `undefined`.
 *
 * @param base - The settings the fake backend starts from (defaults to {@link defaultSettings}).
 */
export function mockSettingsCommands(base: AppSettings = defaultSettings) {
  mockTauri.invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
    if (command === "get_settings") {
      return Promise.resolve(structuredClone(base));
    }
    if (command === "set_settings") {
      return Promise.resolve(deepMergeSettings(structuredClone(base), args?.patch));
    }
    return Promise.resolve(undefined);
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
