import { invoke } from "@tauri-apps/api/core";
import { HistoryEntry } from "../types/HistoryEntry";
import { createCommandError } from "../types/Error";

/**
 * Inserts or updates a history entry for a given path.
 *
 * @param path - The file path or identifier for the history item.
 * @param type - The type of the item (e.g., "file", "directory", "container").
 * @param pageIndex - The optional page index the user was viewing.
 * @throws Will throw a command error if the Tauri invoke fails.
 */
export async function upsertHistory(
  path: string,
  type: string,
  pageIndex: number | undefined,
): Promise<void> {
  try {
    await invoke("upsert_history", { path, itemType: type, pageIndex });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves all history entries.
 *
 * @returns A promise that resolves to an array of `HistoryEntry` objects.
 * @throws Will throw a command error if the Tauri invoke fails.
 */
export async function getAllHistory(): Promise<HistoryEntry[]> {
  try {
    return invoke("get_all_history");
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves the most recently accessed history entry.
 *
 * @returns A promise that resolves to the latest `HistoryEntry`, or `null` if the history is empty.
 * @throws Will throw a command error if the Tauri invoke fails.
 */
export async function getLatestHistory(): Promise<HistoryEntry | null> {
  try {
    return invoke("get_latest_history");
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves a specific history entry by its path.
 *
 * @param path - The path of the history entry to retrieve.
 * @returns A promise that resolves to the `HistoryEntry` if found, or `null` if it does not exist.
 * @throws Will throw a command error if the Tauri invoke fails.
 */
export async function getHistory(path: string): Promise<HistoryEntry | null> {
  try {
    return invoke("get_history", { path });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Deletes a specific history entry by its ID.
 *
 * @param id - The unique identifier of the history entry to delete.
 * @throws Will throw a command error if the Tauri invoke fails.
 */
export async function deleteHistory(id: number): Promise<void> {
  try {
    await invoke("delete_history", { id });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Deletes all history entries from the database.
 *
 * @throws Will throw a command error if the Tauri invoke fails.
 */
export async function deleteAllHistory(): Promise<void> {
  try {
    await invoke("delete_all_history");
  } catch (error) {
    throw createCommandError(error);
  }
}
