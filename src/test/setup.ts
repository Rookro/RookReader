import "@testing-library/jest-dom";
import * as matchers from "@testing-library/jest-dom/matchers";
import { afterEach, expect, vi } from "vitest";
import "./mocks/tauri";
import "./mocks/components";
import "./mocks/bindings";

expect.extend(matchers);

// Mock ResizeObserver which is not available in jsdom
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock;

// jsdom has no media queries either. Reported as never matching, so a component that
// asks gets a definite answer rather than a crash; a test that cares stubs its own.
global.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList;

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
