/**
 * Image data received from the tauri backend.
 */
export class Image {
  /** Pixel data of the image. */
  data: Uint8Array;
  /** Width of the image. */
  width: number;
  /** Height of the image. */
  height: number;

  /**
   * Create a new instance.
   *
   * @param buffer the buffer received from the tauri backend.
   */
  constructor(buffer: ArrayBuffer) {
    const dataView = new DataView(buffer);

    this.width = dataView.getUint32(0);
    this.height = dataView.getUint32(4);
    this.data = new Uint8Array(buffer.slice(8));
  }
}
