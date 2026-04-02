import { describe, expect, it } from "vitest";
import { convertEntriesInDir } from "./DirEntryUtils";

describe("DirEntryUtils", () => {
  // Verify that binary data (ArrayBuffer) is correctly converted to directory/file information (DirEntry) objects
  it("should convert ArrayBuffer to DirEntry objects", () => {
    // Mock data based on the description:
    // is_directory: 1 byte
    // nameLen: 4 bytes
    // name: nameLen bytes
    // last_modified: 8 bytes

    const name1 = "dir1";
    const name2 = "file1.txt";
    const name1Encoded = new TextEncoder().encode(name1);
    const name2Encoded = new TextEncoder().encode(name2);

    const size1 = 1 + 4 + name1Encoded.length + 8;
    const size2 = 1 + 4 + name2Encoded.length + 8;
    const buffer = new Uint8Array(size1 + size2);
    const view = new DataView(buffer.buffer);

    let offset = 0;

    // Entry 1: directory
    view.setUint8(offset++, 1);
    view.setUint32(offset, name1Encoded.length);
    offset += 4;
    buffer.set(name1Encoded, offset);
    offset += name1Encoded.length;
    view.setBigUint64(offset, BigInt(1000));
    offset += 8;

    // Entry 2: file
    view.setUint8(offset++, 0);
    view.setUint32(offset, name2Encoded.length);
    offset += 4;
    buffer.set(name2Encoded, offset);
    offset += name2Encoded.length;
    view.setBigUint64(offset, BigInt(2000));
    offset += 8;

    const result = convertEntriesInDir(buffer.buffer);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      is_directory: true,
      name: "dir1",
      last_modified: new Date(1000).toLocaleString(),
    });
    expect(result[1]).toEqual({
      is_directory: false,
      name: "file1.txt",
      last_modified: new Date(2000).toLocaleString(),
    });
  });

  // Verify that an empty array is returned if the buffer is empty
  it("should return empty array for empty buffer", () => {
    const result = convertEntriesInDir(new ArrayBuffer(0));
    expect(result).toEqual([]);
  });

  // Verify that a malformed buffer (e.g., incomplete data) is handled gracefully without crashing
  it("should handle malformed buffer gracefully (incomplete data)", () => {
    const buffer = new Uint8Array([1, 0, 0, 0, 10]); // is_directory=1, nameLen=10, but no name data
    // This might throw or return partial data depending on implementation.
    // Given the current code uses subarray and decoder,
    // it will likely return an empty string for name if offset is out of bounds
    // Let's verify it doesn't crash the app.
    expect(() => convertEntriesInDir(buffer.buffer)).not.toThrow();
  });
});
