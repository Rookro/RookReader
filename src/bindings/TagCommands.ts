import { commands } from "./bindings";
import { runCommand } from "./result";

/**
 * Creates a new tag in the database.
 *
 * @param name - The name of the new tag.
 * @param colorCode - The color code for the tag (e.g., hex string).
 * @returns A promise that resolves to the newly created Tag object.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function createTag(name: string, colorCode: string) {
  return await runCommand(commands.createTag(name, colorCode));
}

/**
 * Retrieves all tags from the database.
 *
 * @returns A promise that resolves to an array of Tag objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getAllTags() {
  return await runCommand(commands.getAllTags());
}

/**
 * Deletes a tag from the database.
 *
 * @param id - The unique identifier of the tag to delete.
 * @returns A promise that resolves when the tag is successfully deleted.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteTag(id: number): Promise<void> {
  // Throws on error; the unwrapped `null` payload is intentionally ignored.
  await runCommand(commands.deleteTag(id));
}
