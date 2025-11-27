import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router";
import { Provider } from "react-redux";
import { error } from "@tauri-apps/plugin-log";
import { store } from "./Store";

const App = lazy(() => import("./App"));
const SettingsApp = lazy(() => import("./SettingsApp"));

const router = createHashRouter([
  { path: "/", element: <App /> },
  { path: "/settings", element: <SettingsApp /> },
]);

// Prevent the default behavior of opening a context menu on right-click.
document.addEventListener('contextmenu', event => event.preventDefault());

const rootElement = document.getElementById("root");
if (!rootElement) {
  error("Failed to find the root element");
  throw new Error("Failed to find the root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </React.StrictMode>,
);
