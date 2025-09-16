import React from "react";
import ReactDOM from "react-dom/client";
import { Provider, useDispatch } from "react-redux";
import { listen } from "@tauri-apps/api/event";
import { AppDispatch, store } from "./Store";
import { getEntriesInZip, setContainerPath } from "./reducers/FileReducer";
import App from "./App";

// デフォルト動作では右クリックでメニューが開くため、開かないように抑制する
document.addEventListener('contextmenu', event => event.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
