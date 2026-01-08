import { invoke } from "@tauri-apps/api/core";
import { DirEntry } from "../types/DirEntry";

/**
 * Fetches directory entries from the backend.
 *
 * @param dirPath The path of the directory.
 * @returns A promise that resolves to an array of directory entries.
 */
export const getEntriesInDir = async (dirPath: string): Promise<DirEntry[]> => {
    const rawResponse = await invoke<ArrayBuffer>("get_entries_in_dir", { dirPath });
    const buffer = new Uint8Array(rawResponse);
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
        const name = decoder.decode(buffer.slice(offset, offset + nameLen));
        offset += nameLen;

        // last_modified
        const dateLen = view.getUint32(offset);
        offset += 4;
        const last_modified = decoder.decode(buffer.slice(offset, offset + dateLen));
        offset += dateLen;

        entries.push({ is_directory, name, last_modified });
    }
    return entries;
};
