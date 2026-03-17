import "@testing-library/jest-dom";
import * as matchers from "@testing-library/jest-dom/matchers";
import { expect, vi } from "vitest";
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
