import React from "react";
import ReactDOM from "react-dom/client";
import { Provider, useDispatch } from "react-redux";
import { listen } from "@tauri-apps/api/event";
import { AppDispatch, store } from "./Store";
import { getEntriesInZip, setContainerPath } from "./reducers/FileReducer";
import App from "./App";

// デフォルト動作では右クリックでメニューが開くため、開かないように抑制する
document.addEventListener('contextmenu', event => event.preventDefault());

// ドラッグアンドドロップでファイルを指定する
// 複数指定された場合は、最初の一つのみ
listen("tauri://drag-drop", (event) => {
  const dispatch = useDispatch<AppDispatch>();
  const path = (event.payload as { paths: string[] }).paths[0];
  dispatch(setContainerPath(path));
  dispatch(getEntriesInZip(path));
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
