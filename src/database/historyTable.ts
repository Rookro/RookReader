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
            page_index INTEGER NOT NULL DEFAULT 0, \
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
     * @param index The current page index.
     */
    async upsert(path: string, type: 'FILE' | 'DIRECTORY', index: number | undefined = undefined) {
        if (!this.db) {
            this.db = await Database.load(this.dbName);
        }
        const displayName = await basename(path);

        await this.db.execute(
            `\
            INSERT INTO history (path, type, display_name, page_index, last_opened_at) \
            VALUES ($1, $2, $3, ${index !== undefined ? "$4" : "0"}, CURRENT_TIMESTAMP) \
            ON CONFLICT(path) DO UPDATE SET \
            ${index !== undefined ? "page_index = $4, " : ""}\
            last_opened_at = CURRENT_TIMESTAMP;\
            `,
            [path, type, displayName, index]
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

    async selectPageIndex(conttainerPath: string) {
        if (!this.db) {
            this.db = await Database.load(this.dbName);
        }
        const entries = await this.db.select<HistoryEntry[]>(
            "SELECT page_index FROM history WHERE path = $1",
            [conttainerPath]
        );

        return entries[0].page_index;
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
