import type { BookWithState, Series } from "../domain/entities";
import { commands } from "./bindings";
import { runCommand } from "./result";

/**
 * Creates a new series in the database.
 *
 * @param name - The name of the new series.
 * @returns A promise that resolves to the newly created series.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function createSeries(name: string): Promise<Series> {
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

/**
 * Retrieves all books along with their reading states that belong to a specific series.
 *
 * @param seriesId - The unique identifier of the series.
 * @returns A promise that resolves to an array of BookWithState objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getBooksBySeries(seriesId: number): Promise<BookWithState[]> {
  return await runCommand(commands.getBooksBySeries(seriesId));
}

/**
 * Updates the series associated with a specific book.
 *
 * @param bookId - The unique identifier of the book.
 * @param seriesId - The unique identifier of the series to associate with the book, or null to remove.
 * @returns A promise that resolves when the update is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function setSeriesForBook(bookId: number, seriesId: number | null): Promise<void> {
  await runCommand(commands.setSeriesForBook(bookId, seriesId));
}

/**
 * Updates the order of books within a series.
 *
 * @param bookIds - An array of book IDs representing the new order.
 * @returns A promise that resolves when the update is successful.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function setSeriesOrder(bookIds: number[]): Promise<void> {
  await runCommand(commands.setSeriesOrder(bookIds));
}
