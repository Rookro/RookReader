import SettingsListView from "./SettingsListView";
import "./LeftPane.css";

/**
 * 設定画面の左ペイン
 */
function LeftPane() {
    return (
        <div className="settings-left-pane">
            <SettingsListView />
        </div>
    );
}

export default LeftPane;
