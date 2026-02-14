import { invoke } from "@tauri-apps/api/core";
import { createCommandError } from "../types/Error";

/**
 * Opens a container file and fetches its entries from the backend.
 *
 * @param path The path of the container file.
 * @returns A promise that resolves to an array of entry names and whether the container is file or directory.
 */
export const getEntriesInContainer = async (
  path: string,
): Promise<{ entries: string[]; is_directory: boolean }> => {
  try {
    return await invoke("get_entries_in_container", { path });
  } catch (error) {
    throw createCommandError(error);
  }
};

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

/**
 * Sets the rendering height for PDF files in the backend.
 *
 * @param height The rendering height.
 * @returns A promise that resolves when the operation is complete.
 */
export const setPdfRenderingHeight = async (height: number): Promise<void> => {
  try {
    return await invoke("set_pdf_rendering_height", { height });
  } catch (error) {
    throw createCommandError(error);
  }
};

/**
 * Sets the max image height in the backend.
 *
 * @param height The max image height.
 * @returns A promise that resolves when the operation is complete.
 */
export const setMaxImageHeight = async (height: number): Promise<void> => {
  try {
    return await invoke("set_max_image_height", { height });
  } catch (error) {
    throw createCommandError(error);
  }
};

/**
 * Sets the image resize method in the backend.
 *
 * @param method The image resize method.
 * @returns A promise that resolves when the operation is complete.
 */
export const setImageResizeMethod = async (method: string): Promise<void> => {
  try {
    return await invoke("set_image_resize_method", { method });
  } catch (error) {
    throw createCommandError(error);
  }
};

/**
 * Determines if a container is an EPUB novel.
 *
 * @beta
 *
 * @param path The path of the container file.
 * @returns A promise that resolves to true if the container is an EPUB novel, false otherwise.
 */
export const determineEpubNovel = async (path: string): Promise<boolean> => {
  try {
    return await invoke("determine_epub_novel", { path });
  } catch (error) {
    throw createCommandError(error);
  }
};
