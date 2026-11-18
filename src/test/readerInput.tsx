import { useRef } from "react";
import { vi } from "vitest";
import type { PageMove } from "../features/BookReader/hooks/usePageNavigation";
import { useRegisterReaderActions } from "../features/BookReader/input/ReaderInputContext";
import type { ReaderActions } from "../features/BookReader/input/types";

/**
 * Creates spies for the page actions a reader registers; the page moves report that they moved.
 *
 * @returns The spies, usable as {@link ReaderActions}.
 */
export const createReaderActionSpies = () => ({
  nextPage: vi.fn<PageMove>(() => true),
  previousPage: vi.fn<PageMove>(() => true),
  firstPage: vi.fn<() => void>(),
  lastPage: vi.fn<() => void>(),
});

/** Props for {@link TestReader}. */
export interface TestReaderProps {
  /** The actions registered with the enclosing `ReaderInputProvider`. */
  actions: ReaderActions;
  /** The reading area's `data-testid`. */
  testId?: string;
}

/**
 * A stand-in reader: a reading area that registers `actions` with the enclosing
 * `ReaderInputProvider`, so tests can check which inputs reach the reader.
 */
export function TestReader({ actions, testId }: TestReaderProps) {
  const area = useRef<HTMLDivElement>(null);
  useRegisterReaderActions(actions, area);
  return <div ref={area} data-testid={testId} />;
}
