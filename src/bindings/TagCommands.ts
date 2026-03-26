import { invoke } from "@tauri-apps/api/core";
import { Tag } from "../types/DatabaseModels";
import { createCommandError } from "../types/Error";

/**
 * Creates a new tag in the database.
 *
 * @param name - The name of the new tag.
 * @param colorCode - The color code for the tag (e.g., hex string).
 * @returns A promise that resolves to the newly created Tag object.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function createTag(name: string, colorCode: string) {
  try {
    return await invoke<Tag>("create_tag", { name, colorCode });
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Retrieves all tags from the database.
 *
 * @returns A promise that resolves to an array of Tag objects.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function getAllTags() {
  try {
    return await invoke<Tag[]>("get_all_tags");
  } catch (error) {
    throw createCommandError(error);
  }
}

/**
 * Deletes a tag from the database.
 *
 * @param id - The unique identifier of the tag to delete.
 * @returns A promise that resolves when the tag is successfully deleted.
 * @throws {CommandError} If the Tauri command fails.
 */
export async function deleteTag(id: number) {
  try {
    return await invoke<void>("delete_tag", { id });
  } catch (error) {
    throw createCommandError(error);
  }
}
