import { DirEntry } from "../types/DirEntry";

/**
 * Converts directory entry data from an ArrayBuffer into an array of DirEntry objects.
 * The ArrayBuffer is expected to be a serialized sequence of directory entries.
 * Each entry is encoded with the following structure:
 * - is_directory: 1 byte (1 for directory, 0 for file)
 * - nameLen: 4 bytes (length of the name string)
 * - name: nameLen bytes (UTF-8 encoded name string)
 * - last_modified: 8 bytes (Unix timestamp as a 64-bit integer)
 *
 * @param entriesData - The ArrayBuffer containing the serialized directory entry data.
 * @returns A promise that resolves to an array of DirEntry objects.
 */
export const convertEntriesInDir = (entriesData: ArrayBuffer) => {
  const buffer = entriesData instanceof Uint8Array ? entriesData : new Uint8Array(entriesData);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const decoder = new TextDecoder();

  const entries: DirEntry[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    // is_directory
    const is_directory = view.getUint8(offset) === 1;
    offset += 1;

    // name
    const nameLen = view.getUint32(offset);
    offset += 4;
    const name = decoder.decode(buffer.subarray(offset, offset + nameLen));
    offset += nameLen;

    // last_modified
    const timestamp = view.getBigUint64(offset);
    const last_modified = new Date(Number(timestamp)).toLocaleString();
    offset += 8;

    entries.push({ is_directory, name, last_modified });
  }
  return entries;
};
