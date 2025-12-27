import { invoke } from "@tauri-apps/api/core";

/**
 * Opens a container file and fetches its entries from the backend.
 *
 * @param path The path of the container file.
 * @returns A promise that resolves to an array of entry names.
 */
export const getEntriesInContainer = async (path: string): Promise<string[]> => {
    return invoke("get_entries_in_container", { path });
};

/**
 * Fetches an image from a container in the backend.
 *
 * @param path The path of the container file.
 * @param entryName The name of the image entry.
 * @returns A promise that resolves to the image data as an ArrayBuffer.
 */
export const getImage = async (path: string, entryName: string): Promise<ArrayBuffer> => {
    return invoke("get_image", { path, entryName });
};

/**
 * Sets the rendering height for PDF files in the backend.
 *
 * @param height The rendering height.
 * @returns A promise that resolves when the operation is complete.
 */
export const setPdfRenderingHeight = async (height: number): Promise<void> => {
    return invoke("set_pdf_rendering_height", { height });
};
