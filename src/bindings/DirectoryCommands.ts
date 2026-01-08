import { Channel, invoke } from "@tauri-apps/api/core";
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


export const getEntriesStream = async (dirPath: string, onProgress: (entries: DirEntry[]) => void) => {
    const decoder = new TextDecoder();

    // Tauri v2 の Channel を作成
    const channel = new Channel<Uint8Array>();

    channel.onmessage = (message) => {
        // message は Rust から送られた Vec<u8> (JS では number[] か Uint8Array)
        // データ型が number[] で来る場合があるので Uint8Array に変換
        const rawData = message instanceof Uint8Array ? message : new Uint8Array(message);

        const view = new DataView(rawData.buffer, rawData.byteOffset, rawData.byteLength);
        const chunkEntries: DirEntry[] = [];
        let offset = 0;

        while (offset < rawData.length) {
            // 1. is_directory
            const is_directory = view.getUint8(offset) === 1;
            offset += 1;

            // 2. name
            const nameLen = view.getUint32(offset); // BigEndian (Rustのto_be_bytesに合わせる)
            offset += 4;

            // ★高速化ポイント: slice ではなく subarray を使う
            const name = decoder.decode(rawData.subarray(offset, offset + nameLen));
            offset += nameLen;

            // 3. timestamp (i64 -> BigInt)
            const timestamp = view.getBigInt64(offset);
            offset += 8;

            // Dateオブジェクト作成 (表示用フォーマットはUI描画時にやるのが定石)
            const last_modified = new Date(Number(timestamp)).toISOString();

            chunkEntries.push({ is_directory, name, last_modified });
        }

        // コールバックで部分データを渡す
        onProgress(chunkEntries);
    };

    // Rustコマンドの呼び出し
    // 引数名はRust側の引数名(snake_case)ではなくキャメルケースに自動変換される場合があるため注意
    // Tauri v2では通常 `onEvent` のようにキャメルケース指定でRustの `on_event` にマッピングされます
    await invoke('get_entries_stream', { dirPath, onEvent: channel });

    console.log("All chunks received");
};
