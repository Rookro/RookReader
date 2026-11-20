import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs callbacks after the calling component's next commit, for example to move focus once a
 * closing menu's focus trap has let go.
 *
 * @returns A stable function that queues a callback and triggers the commit that runs it once.
 */
export function useAfterCommit(): (callback: () => void) => void {
  const queue = useRef<(() => void)[]>([]);
  const [commits, setCommits] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: drains the queue after each requested commit.
  useEffect(() => {
    const callbacks = queue.current;
    queue.current = [];
    for (const callback of callbacks) {
      callback();
    }
  }, [commits]);

  return useCallback((callback: () => void) => {
    queue.current.push(callback);
    setCommits((n) => n + 1);
  }, []);
}
