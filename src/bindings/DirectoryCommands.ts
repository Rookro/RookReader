import { runBinaryCommand } from "./result";

/**
 * Fetches directory entries from the backend.
 *
 * @param dirPath The path of the directory.
 * @returns A promise that resolves to the data of directory entries.
 */
export async function getEntriesInDir(dirPath: string): Promise<ArrayBuffer> {
  return runBinaryCommand("get_entries_in_dir", { dirPath });
}
