import { useEffect, useRef } from "react";
import { listen, Event, UnlistenFn } from "@tauri-apps/api/event";

/**
 * A custom hook for handling Tauri events.
 *
 * This hook simplifies the process of subscribing to and unsubscribing from Tauri events
 * by managing the lifecycle of the event listener automatically.
 *
 * @template T The type of the event payload.
 * @param eventName The name of the Tauri event to listen to.
 * @param handler A callback function to be executed when the event is received.
 */
export const useTauriEvent = <T>(eventName: string, handler: (event: Event<T>) => void) => {
  const handlerRef = useRef(handler);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    let isMounted = true;

    const setupListener = async () => {
      const unlisten = await listen<T>(eventName, (event) => {
        handlerRef.current(event);
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
  }, [eventName]);
};
