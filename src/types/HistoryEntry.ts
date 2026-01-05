/**
 * Represents a single entry in the history.
 */
export type HistoryEntry = {
    /** Unique identifier for the history entry */
    id?: number;
    /** Full path to the file or directory */
    path: string;
    /** Whether it's a file or a directory */
    type: 'FILE' | 'DIRECTORY';
    /** Display name of the history entry */
    display_name: string;
    /** Timestamp of the last time the entry was opened */
    last_opened_at: string;
}
