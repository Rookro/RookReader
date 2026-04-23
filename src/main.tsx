import { error } from "@tauri-apps/plugin-log";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { createHashRouter, RouterProvider } from "react-router";
import App from "./App";
import { loadAllSettings } from "./features/Settings/settingsStore";
import SettingsApp from "./SettingsApp";
import { createStore } from "./store/store";
import "./i18n/config";
import "allotment/dist/style.css";

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
