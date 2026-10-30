import { commands, type ImageDimensions } from "./bindings";
import { runBinaryCommand, runCommand } from "./result";

/**
 * Opens a book as the open book, replacing the previous one, and fetches its entries.
 *
 * @param path The path of the container file.
 * @returns A promise that resolves to an object containing entries, directory status, and novel status.
 */
export async function openContainer(path: string) {
  return await runCommand(commands.openContainer(path));
}

/**
 * Requests preloading of images around a specific index in the backend.
 *
 * @param path The path of the container the caller believes is open. The backend rejects
 *   the request if a different book is open, which is what keeps a preload issued just
 *   before a book switch from warming the wrong pages.
 * @param index The current page index around which to preload.
 * @param bufferSize How many pages to preload in each direction.
 * @param callerPages How many pages from `index` the caller is fetching itself. They are
 *   left out of the window: the caller asks for them at foreground priority, so
 *   preloading them only lets a background job reach them first, and the foreground
 *   request then waits on that job instead of being served.
 * @returns A promise that resolves when the request is submitted.
 */
export async function requestPreloadAround(
  path: string,
  index: number,
  bufferSize: number | undefined = undefined,
  callerPages: number | undefined = undefined,
): Promise<void> {
  await runCommand(
    commands.requestPreloadAround(path, index, bufferSize ?? null, callerPages ?? null),
  );
}

/**
 * Fetches the pixel dimensions of every entry in the opened container.
 *
 * @param path The path of the container file.
 * @returns A promise that resolves to one dimensions record per entry, in entry order.
 */
export async function getImageDimensions(path: string): Promise<ImageDimensions[]> {
  return await runCommand(commands.getImageDimensions(path));
}

/**
 * Tells the backend how large the reader draws a page, in device pixels.
 *
 * Pages come back fitted to it, so the viewer can draw them 1:1: the browser's own
 * downscale is what puts moiré on a screentoned page.
 *
 * No path, unlike the commands above: the viewport belongs to the window, so it is
 * recorded whether or not a book is open and survives a book switch.
 *
 * @param width The reader viewport's width in device pixels.
 * @param height The reader viewport's height in device pixels.
 * @returns A promise that resolves once the backend has the size.
 */
export async function setDisplaySize(width: number, height: number): Promise<void> {
  await runCommand(commands.setDisplaySize(width, height));
}

// The binary commands return a raw `tauri::ipc::Response`, which is not in the generated `commands`.

/**
 * Fetches an image from a container in the backend.
 *
 * @param path The path of the container file.
 * @param entryName The name of the image entry.
 * @returns A promise that resolves to the image data as an ArrayBuffer.
 */
export async function getImage(path: string, entryName: string): Promise<ArrayBuffer> {
  return runBinaryCommand("get_image", { path, entryName });
}

/**
 * Fetches a page at its full size, for the loupe.
 *
 * Every other page arrives fitted to the reader's viewport. The loupe draws a page
 * magnified, so a fitted one would only be an upscale of what is already on screen.
 *
 * @param path The path of the container file.
 * @param entryName The name of the image entry.
 * @returns A promise that resolves to the image data as an ArrayBuffer.
 */
export async function getImageFull(path: string, entryName: string): Promise<ArrayBuffer> {
  return runBinaryCommand("get_image_full", { path, entryName });
}

/**
 * Fetches an image preview from a container in the backend.
 *
 * @param path The path of the container file.
 * @param entryName The name of the image entry.
 * @returns A promise that resolves to the image data as an ArrayBuffer.
 */
export async function getImagePreview(path: string, entryName: string): Promise<ArrayBuffer> {
  return runBinaryCommand("get_image_preview", { path, entryName });
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
