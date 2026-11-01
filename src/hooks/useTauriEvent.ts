import type { EventCallback, UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

/**
 * An event from the generated `events` in `src/bindings/bindings.ts`.
 *
 * @template T The type of the event payload.
 */
export interface TauriEvent<T> {
  /** Starts listening; resolves to the function that stops it. */
  listen: (handler: EventCallback<T>) => Promise<UnlistenFn>;
}

/**
 * A custom hook for handling Tauri events.
 *
 * This hook simplifies the process of subscribing to and unsubscribing from Tauri events
 * by managing the lifecycle of the event listener automatically.
 *
 * @template T The type of the event payload.
 * @param event The generated event to listen to, e.g. `events.booksChanged`.
 * @param handler A callback function to be executed when the event is received.
 */
export const useTauriEvent = <T>(event: TauriEvent<T>, handler: EventCallback<T>) => {
  const handlerRef = useRef(handler);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    let isMounted = true;

    const setupListener = async () => {
      const unlisten = await event.listen((received) => {
        handlerRef.current(received);
      });

      if (isMounted) {
        unlistenRef.current = unlisten;
      } else {
        unlisten();
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, [event]);
};
