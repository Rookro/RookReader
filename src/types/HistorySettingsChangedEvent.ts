/**
 * The payload for the history settings changed event.
 */
export interface HistorySettingsChangedEvent {
    /** Whether history feature is enabled */
    historyEnabled?: boolean;
    /** Whether to restore the last opened container on startup */
    restoreLastContainer?: boolean;
}
