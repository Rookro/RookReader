import { invoke } from "@tauri-apps/api/core";
import { DirEntry } from "../types/DirEntry";

/**
 * Fetches directory entries from the backend.
 *
 * @param dirPath The path of the directory.
 * @returns A promise that resolves to an array of directory entries.
 */
export const getEntriesInDir = async (dirPath: string): Promise<DirEntry[]> => {
    return invoke("get_entries_in_dir", { dirPath });
};
