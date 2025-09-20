import FileListViewer from "../FileListViewer/FileListViewer";
import "./LeftPane.css";

/**
 * 左ペイン
 */
function LeftPane() {
    return (
        <div className="left_pane">
            <FileListViewer />
        </div>
    );
}

export default LeftPane;
