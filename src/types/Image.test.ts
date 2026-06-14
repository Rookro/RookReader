import { describe, expect, it } from "vitest";
import { Image } from "./Image";

describe("Image", () => {
  it("should correctly parse width, height, and use a zero-copy view of the data", () => {
    // Create an ArrayBuffer of 12 bytes
    // Bytes 0-3: width (e.g. 100)
    // Bytes 4-7: height (e.g. 200)
    // Bytes 8-11: data (e.g. [1, 2, 3, 4])
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);

    view.setUint32(0, 100);
    view.setUint32(4, 200);

    const u8View = new Uint8Array(buffer);
    u8View[8] = 1;
    u8View[9] = 2;
    u8View[10] = 3;
    u8View[11] = 4;

    const image = new Image(buffer);

    expect(image.width).toBe(100);
    expect(image.height).toBe(200);
    expect(image.data.length).toBe(4);
    expect(image.data[0]).toBe(1);
    expect(image.data[3]).toBe(4);

    // Verify zero-copy: modifying the original buffer should change the image data
    u8View[8] = 99;
    expect(image.data[0]).toBe(99);

    // Verify the underlying buffer is the exact same reference
    expect(image.data.buffer).toBe(buffer);
  });
});
