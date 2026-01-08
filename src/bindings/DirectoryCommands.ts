import { invoke } from "@tauri-apps/api/core";
import { DirEntry } from "../types/DirEntry";
import { debug } from "@tauri-apps/plugin-log";

/**
 * Fetches directory entries from the backend.
 *
 * @param dirPath The path of the directory.
 * @returns A promise that resolves to an array of directory entries.
 */
export const getEntriesInDir = async (dirPath: string): Promise<DirEntry[]> => {
    const start1 = performance.now();
    const rawResponse = await invoke<ArrayBuffer>("get_entries_in_dir", { dirPath });
    const elapsed1 = performance.now() - start1;
    const start2 = performance.now();
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
        const name = decoder.decode(buffer.subarray(offset, offset + nameLen));
        offset += nameLen;

        // last_modified
        const timestamp = view.getBigInt64(offset); // BigEndianならRust側も合わせる
        // Dateオブジェクトが必要ならここで変換、不要ならnumberのまま保持が最速
        const last_modified = new Date(Number(timestamp)).toISOString();
        offset += 8;

        entries.push({ is_directory, name, last_modified });
    }
    const elapsed2 = performance.now() - start2;
    debug(`elapsed time: ${elapsed1}ms, ${elapsed2}ms`);
    return entries;
};
