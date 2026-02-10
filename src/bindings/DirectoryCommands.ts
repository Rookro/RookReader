import { invoke } from "@tauri-apps/api/core";
import { createCommandError } from "../types/Error";

/**
 * Fetches directory entries from the backend.
 *
 * @param dirPath The path of the directory.
 * @returns A promise that resolves to the data of directory entries.
 */
export const getEntriesInDir = async (dirPath: string): Promise<ArrayBuffer> => {
  try {
    return await invoke<ArrayBuffer>("get_entries_in_dir", { dirPath });
  } catch (error) {
    throw createCommandError(error);
  }
};
