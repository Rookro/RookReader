import { invoke } from "@tauri-apps/api/core";
import { createCommandError } from "../types/Error";
import { commands } from "./bindings";
import { getDataOrThrow } from "./result";

/**
 * Opens a container file and fetches its entries from the backend.
 *
 * @param path The path of the container file.
 * @returns A promise that resolves to an object containing entries, directory status, and novel status.
 */
export const getEntriesInContainer = async (path: string) => {
  try {
    return getDataOrThrow(await commands.getEntriesInContainer(path));
  } catch (error) {
    throw createCommandError(error);
  }
};

/**
 * Requests preloading of images around a specific index in the backend.
 *
 * @param index The current page index around which to preload.
 * @param bufferSize How many pages to preload in each direction.
 * @returns A promise that resolves when the request is submitted.
 */
export const requestPreloadAround = async (
  index: number,
  bufferSize: number | undefined = undefined,
): Promise<void> => {
  try {
    getDataOrThrow(await commands.requestPreloadAround(index, bufferSize ?? null));
  } catch (error) {
    throw createCommandError(error);
  }
};

// NOTE: `getImage` / `getImagePreview` return a raw binary `tauri::ipc::Response` from the backend,
// which has no `specta::Type` and is not part of the generated `commands`. They keep a hand-written
// `invoke` wrapper that receives the custom `[width][height][data]` binary payload.

/**
 * Fetches an image from a container in the backend.
 *
 * @param path The path of the container file.
 * @param entryName The name of the image entry.
 * @returns A promise that resolves to the image data as an ArrayBuffer.
 */
export const getImage = async (path: string, entryName: string): Promise<ArrayBuffer> => {
  try {
    return await invoke("get_image", { path, entryName });
  } catch (error) {
    throw createCommandError(error);
  }
};

/**
 * Fetches an image preview from a container in the backend.
 *
 * @param path The path of the container file.
 * @param entryName The name of the image entry.
 * @returns A promise that resolves to the image data as an ArrayBuffer.
 */
export const getImagePreview = async (path: string, entryName: string): Promise<ArrayBuffer> => {
  try {
    return await invoke("get_image_preview", { path, entryName });
  } catch (error) {
    throw createCommandError(error);
  }
};
