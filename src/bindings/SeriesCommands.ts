import { commands } from "./bindings";
import { runCommand } from "./result";

/**
 * Creates a new series in the database.
 *
 * @param name - The name of the new series.
 * @returns A promise that resolves to the ID of the newly created series.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function createSeries(name: string) {
  return await runCommand(commands.createSeries(name));
}

/**
 * Retrieves all series from the database.
 *
 * @returns A promise that resolves to an array of Series objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getAllSeries() {
  return await runCommand(commands.getAllSeries());
}

/**
 * Deletes a series by its ID.
 *
 * @param id - The ID of the series to delete.
 * @returns A promise that resolves when the series is deleted.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteSeries(id: number): Promise<void> {
  await runCommand(commands.deleteSeries(id));
}
