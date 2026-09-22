import { CommandError, ErrorCode } from "./Error";

/** The `[width][height]` header every page payload starts with. */
const HEADER_BYTES = 8;

/**
 * Image data received from the tauri backend.
 */
export class Image {
  /** Pixel data of the image. */
  data: Uint8Array<ArrayBuffer>;
  /** Width of the image. */
  width: number;
  /** Height of the image. */
  height: number;

  /**
   * Create a new instance.
   *
   * @param buffer the buffer received from the tauri backend.
   * @throws {CommandError} With {@link ErrorCode.image} when the buffer is too short to hold the header.
   */
  constructor(buffer: ArrayBuffer) {
    if (buffer.byteLength < HEADER_BYTES) {
      throw new CommandError(
        ErrorCode.image,
        `Image payload too short: ${buffer.byteLength} bytes`,
      );
    }
    const dataView = new DataView(buffer);

    this.width = dataView.getUint32(0);
    this.height = dataView.getUint32(4);
    this.data = new Uint8Array(buffer, HEADER_BYTES);
  }
}
