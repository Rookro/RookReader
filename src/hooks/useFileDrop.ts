import { useState, useEffect } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { debug } from '@tauri-apps/plugin-log';

/**
 * Hook to handle file drop events in a Tauri application.
 */
export const useFileDrop = () => {
    const [droppedFile, setDroppedFile] = useState<string | undefined>(undefined);

    useEffect(() => {
        let unlisten: UnlistenFn | undefined;
        const startListening = async () => {
            unlisten = await listen("tauri://drag-drop", async (event) => {
                const payload = event.payload as { paths: string[] };
                if (payload.paths && payload.paths.length > 0) {
                    const path = payload.paths[0];
                    debug(`DragDrop ${path}.`);
                    setDroppedFile(path);
                }
            });
        };
        startListening();

        return () => {
            unlisten?.();
        };
    }, []);

    return { droppedFile };
};
