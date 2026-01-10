import { Channel, invoke } from "@tauri-apps/api/core";

/**
 * Establishes a stream for directory entries from the backend.
 * The backend will send directory entry data through the provided channel.
 *
 * @param dirPath The path of the directory to stream.
 * @param channel The channel to send the directory entry data to.
 */
export const streamEntriesInDir = async (dirPath: string, channel: Channel<ArrayBuffer>) => {
    await invoke<void>('stream_entries_in_dir', { dirPath, channel });
};
