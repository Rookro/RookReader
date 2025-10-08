import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router";
import { Provider } from "react-redux";
import { store } from "./Store";
import App from "./App";
import SettingsApp from "./SettingsApp";

const router = createHashRouter([
  { path: "/", element: <App /> },
  { path: "/settings", element: <SettingsApp /> },
]);

// デフォルト動作では右クリックでメニューが開くため、開かないように抑制する
document.addEventListener('contextmenu', event => event.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </React.StrictMode>,
);
