import { invoke } from "@tauri-apps/api/core";
import type { Series } from "../types/DatabaseModels";
import { createCommandError } from "../types/Error";

/**
 * Creates a new series in the database.
 *
 * @param name - The name of the new series.
 * @returns A promise that resolves to the ID of the newly created series.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function createSeries(name: string) {
  try {
    return await invoke<number>("create_series", { name });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves all series from the database.
 *
 * @returns A promise that resolves to an array of Series objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getAllSeries() {
  try {
    return await invoke<Series[]>("get_all_series");
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Deletes a series by its ID.
 *
 * @param id - The ID of the series to delete.
 * @returns A promise that resolves when the series is deleted.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteSeries(id: number) {
  try {
    return await invoke<void>("delete_series", { id });
  } catch (error) {
    throw createCommandError(error);
  }
}
