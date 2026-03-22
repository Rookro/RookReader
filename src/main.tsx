import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router";
import { Provider } from "react-redux";
import { error } from "@tauri-apps/plugin-log";
import { createStore } from "./Store";
import { loadAllSettings } from "./settings/SettingsStore";
import "./i18n/config";
import "allotment/dist/style.css";

const App = lazy(() => import("./App"));
const SettingsApp = lazy(() => import("./SettingsApp"));

const router = createHashRouter([
  { path: "/", element: <App /> },
  { path: "/settings", element: <SettingsApp /> },
]);

// Prevent the default behavior of opening a context menu on right-click.
document.addEventListener("contextmenu", (event) => event.preventDefault());

const rootElement = document.getElementById("root");
if (!rootElement) {
  error("Failed to find the root element");
  throw new Error("Failed to find the root element");
}

const initializeAndRender = async () => {
  try {
    const settings = await loadAllSettings();

    const preloadedState = {
      settings,
      view: {
        fontFamily: settings["font-family"],
        activeView: settings["initial-view"] as "reader" | "bookshelf",
        isTwoPagedView: settings["two-paged"],
        direction: settings.direction,
        isFirstPageSingleView: settings["first-page-single-view"],
        enablePreview: settings.rendering["enable-preview"],
        enableHistory: settings.history.enable,
        novel: {
          font: settings["novel-reader"].font || "default-font",
          fontSize: settings["novel-reader"]["font-size"] || 16,
        },
      },
    };

    const store = createStore(preloadedState);

    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <Provider store={store}>
          <RouterProvider router={router} />
        </Provider>
      </React.StrictMode>,
    );
  } catch (err) {
    error(`Failed to initialize app: ${err}`);
  }
};

initializeAndRender();
