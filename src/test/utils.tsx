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
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof createTestStore>;

interface ExtendedRenderOptions extends Omit<RenderOptions, "queries"> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
}

export const createTestStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  });
};

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
