import { invoke } from "@tauri-apps/api/core";

/**
 * Fetches directory entries from the backend.
 *
 * @param dirPath The path of the directory.
 * @returns A promise that resolves to the data of directory entries.
 */
export const getEntriesInDir = async (dirPath: string): Promise<ArrayBuffer> => {
    return invoke<ArrayBuffer>("get_entries_in_dir", { dirPath });
};
