import { basename } from "@tauri-apps/api/path";
import Database from "@tauri-apps/plugin-sql";
import { HistoryEntry } from "../types/HistoryEntry";

/**
 * Data Access Object for managing the history table.
 */
export class HistoryTable {
    /**
     * Database name.
     */
    private dbName = "sqlite:history.db";

    /**
     * Database instance.
     */
    private db: Database | null = null;

    /**
     * Initializes the database and creates the history table if it doesn't exist.
     */
    async init() {
        if (!this.db) {
            this.db = await Database.load(this.dbName);
        }
        await this.db.execute(
            "\
            CREATE TABLE IF NOT EXISTS history ( \
            id INTEGER PRIMARY KEY AUTOINCREMENT, \
            path TEXT NOT NULL UNIQUE, \
            type TEXT CHECK(type IN ('FILE', 'DIRECTORY')) NOT NULL, \
            display_name TEXT NOT NULL, \
            last_opened_at DATETIME DEFAULT CURRENT_TIMESTAMP \
            );\
            CREATE INDEX IF NOT EXISTS idx_last_opened_at ON history(last_opened_at DESC);\
            "
        );
    }

    /**
     * Upserts a history record.
     * If the path already exists, updates the timestamp.
     * 
     * @param path Full path to the file or directory
     * @param type Whether it's a file or a directory
     * @param format File extension (e.g., 'zip', 'pdf'), or null for directories
     */
    async upsert(path: string, type: 'FILE' | 'DIRECTORY') {
        if (!this.db) {
            this.db = await Database.load(this.dbName);
        }
        const displayName = await basename(path);

        await this.db.execute(
            "\
            INSERT INTO history (path, type, display_name, last_opened_at) \
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP) \
            ON CONFLICT(path) DO UPDATE SET \
            last_opened_at = CURRENT_TIMESTAMP \
            ",
            [path, type, displayName]
        );
    }

    /**
     * Retrieves the all history entries.
     * 
     * @returns Array of history entries sorted by last opened date
     */
    async selectOrderByLastOpenedAtDesc() {
        if (!this.db) {
            this.db = await Database.load(this.dbName);
        }
        const entries = await this.db.select<HistoryEntry[]>(
            "SELECT * FROM history ORDER BY last_opened_at DESC"
        );

        // Convert last_opened_at to local time.
        entries.forEach((entry) => {
            const utcDateStr = entry.last_opened_at.slice(-1) === 'Z'
                ? entry.last_opened_at
                : `${entry.last_opened_at}Z`;
            entry.last_opened_at = new Date(utcDateStr).toLocaleString();
        });
        return entries;
    }

    /**
     * Deletes a specific history entry by its ID.
     * 
     * @param id The unique identifier of the entry
     */
    async delete(id: number) {
        if (!this.db) {
            this.db = await Database.load(this.dbName);
        }
        await this.db.execute("DELETE FROM history WHERE id = $1", [id]);
    }

    /**
     * Deletes all records from the history table.
     */
    async deleteAll() {
        if (!this.db) {
            this.db = await Database.load(this.dbName);
        }
        await this.db.execute("DELETE FROM history");
    }
}
