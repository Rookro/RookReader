import { commands, type ImageDimensions } from "./bindings";
import { runCommand } from "./result";

export { getImage, getImageFull, getImagePreview, readNovelFile } from "./binaryCommands";

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
  bufferSize: number,
  callerPages: number,
): Promise<void> {
  await runCommand(commands.requestPreloadAround(path, index, bufferSize, callerPages));
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
