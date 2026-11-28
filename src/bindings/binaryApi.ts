import { runBinaryCommand } from "./result";

// The binary commands return a raw `tauri::ipc::Response`, which is not in the generated `commands`.

/**
 * Fetches an image from a container in the backend.
 *
 * @param path The path of the container file.
 * @param entryName The name of the image entry.
 * @param generation The reader's display generation; a newer one cancels older queued requests.
 * @returns A promise that resolves to the image data as an ArrayBuffer.
 */
export async function getImage(
  path: string,
  entryName: string,
  generation: number,
): Promise<ArrayBuffer> {
  return runBinaryCommand("get_image", { path, entryName, generation });
}

/**
 * Fetches a page fitted to the reader's viewport times `zoom`, for the loupe.
 *
 * At zoom 1 this hits the viewer's cached page and avoids browser downscale moiré.
 *
 * @param path The path of the container file.
 * @param entryName The name of the image entry.
 * @param zoom The loupe's magnification factor.
 * @returns A promise that resolves to the image data as an ArrayBuffer.
 */
export async function getImageMagnified(
  path: string,
  entryName: string,
  zoom: number,
): Promise<ArrayBuffer> {
  return runBinaryCommand("get_image_magnified", { path, entryName, zoom });
}

/**
 * Fetches an image preview from a container in the backend.
 *
 * @param path The path of the container file.
 * @param entryName The name of the image entry.
 * @param generation The reader's display generation; a newer one cancels older queued requests.
 * @returns A promise that resolves to the image data as an ArrayBuffer.
 */
export async function getImagePreview(
  path: string,
  entryName: string,
  generation: number,
): Promise<ArrayBuffer> {
  return runBinaryCommand("get_image_preview", { path, entryName, generation });
}

/**
 * Reads the EPUB file of the open novel.
 *
 * The backend serves only the novel that is open, so the webview needs no permission to
 * read files itself.
 *
 * @param path The path of the open novel.
 * @returns A promise that resolves to the file's bytes.
 */
export async function readNovelFile(path: string): Promise<ArrayBuffer> {
  return runBinaryCommand("read_novel_file", { path });
}

/**
 * Fetches directory entries from the backend.
 *
 * @param dirPath The path of the directory.
 * @returns A promise that resolves to the data of directory entries.
 */
export async function getEntriesInDir(dirPath: string): Promise<ArrayBuffer> {
  return runBinaryCommand("get_entries_in_dir", { dirPath });
}
