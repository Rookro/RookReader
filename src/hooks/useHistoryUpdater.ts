import { useEffect, useRef } from 'react';
import { debug } from '@tauri-apps/plugin-log';
import { useAppDispatch, useAppSelector } from '../Store';
import { HistoryTable } from '../database/historyTable';
import { setHistoryEntries, setIsHistoryEnabled } from '../reducers/HistoryReducer';
import { settingsStore } from '../settings/SettingsStore';
import { setImageIndex } from '../reducers/FileReducer';

/**
 * Custom hook to update history entries in the database and Redux store.
 */
export const useHistoryUpdater = () => {
    const { history, historyIndex, isDirectory, isLoading, error } = useAppSelector((state) => state.file.containerFile);
    const { isHistoryEnabled } = useAppSelector((state) => state.history);
    const historyTableRef = useRef(new HistoryTable());
    const dispatch = useAppDispatch();

    useEffect(() => {
        const initHistory = async () => {
            const isHistoryEnabled = await settingsStore.get<boolean>("history-enabled") ?? true;
            dispatch(setIsHistoryEnabled(isHistoryEnabled));

            if (!isHistoryEnabled) {
                return;
            }

            await historyTableRef.current.init();
            const entries = await historyTableRef.current.selectOrderByLastOpenedAtDesc();
            dispatch(setHistoryEntries(entries));
        };
        initHistory();
    }, []);

    useEffect(() => {
        if (isHistoryEnabled) {
            return;
        }

        const clearHistory = async () => {
            await historyTableRef.current.deleteAll();
        };
        clearHistory();
    }, [isHistoryEnabled]);

    useEffect(() => {
        if (!isHistoryEnabled) {
            dispatch(setHistoryEntries([]));
            return;
        }

        if (isLoading || error) {
            return;
        }

        const updateHistory = async () => {
            if (history.length > 0 && historyIndex >= 0) {
                const currentPath = history[historyIndex];
                if (currentPath) {
                    debug(`Update container history: ${currentPath}, ${isDirectory ? 'DIRECTORY' : 'FILE'}`);
                    await historyTableRef.current.upsert(currentPath, isDirectory ? 'DIRECTORY' : 'FILE');
                    const entries = await historyTableRef.current.selectOrderByLastOpenedAtDesc();
                    dispatch(setHistoryEntries(entries));
                    const lastPageIndex = await historyTableRef.current.selectPageIndex(currentPath);
                    dispatch(setImageIndex(lastPageIndex));
                }
            }
        };
        updateHistory();
    }, [isHistoryEnabled, isLoading, error, dispatch]); // Only run when isLoading changes to false and error is not set.
};
