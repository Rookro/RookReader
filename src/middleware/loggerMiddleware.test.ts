import { describe, it, expect, vi, beforeEach } from "vitest";
import { loggerMiddleware } from "./loggerMiddleware";
import { debug, trace } from "@tauri-apps/plugin-log";
import { MiddlewareAPI } from "@reduxjs/toolkit";

describe("loggerMiddleware", () => {
  const mockStore = {
    getState: vi.fn(() => ({ state: "mock" })),
    dispatch: vi.fn(),
  } as unknown as MiddlewareAPI;

  const mockNext = vi.fn((action: unknown) => action);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that a simple action (small payload) is correctly logged
  it("should log a simple action", () => {
    const action = { type: "TEST_ACTION", payload: { small: "data" } };
    loggerMiddleware(mockStore)(mockNext)(action);

    expect(debug).toHaveBeenCalledWith(
      `Dispatching action. type:TEST_ACTION, payload:${JSON.stringify(action.payload)}`,
    );
    expect(mockNext).toHaveBeenCalledWith(action);
    expect(trace).toHaveBeenCalledWith(
      `[loggerMiddleware] next state: ${JSON.stringify({ state: "mock" })}`,
    );
  });

  // Verify that large objects are suppressed in debug logs but shown in full in trace logs
  it("should suppress large objects in debug log but show them in trace log", () => {
    const largePayload = {
      items: Array.from({ length: 11 }, (_, i) => i),
    };
    const action = { type: "LARGE_ACTION", payload: largePayload };
    loggerMiddleware(mockStore)(mockNext)(action);

    expect(debug).toHaveBeenCalledWith(
      "Dispatching action. type:LARGE_ACTION}, payload: Large Object(Suppressed)",
    );
    expect(trace).toHaveBeenCalledWith(
      `Dispatching action. type:LARGE_ACTION}, payload:${JSON.stringify(largePayload)}`,
    );
  });

  // Verify that large nested objects are correctly detected and suppressed in debug logs
  it("should detect large nested objects", () => {
    const nestedLargePayload = {
      level1: {
        level2: {
          level3: Array.from({ length: 11 }, (_, i) => i),
        },
      },
    };
    const action = { type: "NESTED_LARGE_ACTION", payload: nestedLargePayload };
    loggerMiddleware(mockStore)(mockNext)(action);

    expect(debug).toHaveBeenCalledWith(
      "Dispatching action. type:NESTED_LARGE_ACTION}, payload: Large Object(Suppressed)",
    );
  });

  // Verify that objects with more than 10 keys are judged as "large" and suppressed in debug logs
  it("should detect objects with more than 10 keys", () => {
    const manyKeysPayload = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [`key${i}`, i]),
    );
    const action = { type: "MANY_KEYS_ACTION", payload: manyKeysPayload };
    loggerMiddleware(mockStore)(mockNext)(action);

    expect(debug).toHaveBeenCalledWith(
      "Dispatching action. type:MANY_KEYS_ACTION}, payload: Large Object(Suppressed)",
    );
  });

  // Verify that actions with a null payload are handled without errors
  it("should handle null payload gracefully", () => {
    const action = { type: "NULL_PAYLOAD", payload: null };
    loggerMiddleware(mockStore)(mockNext)(action);

    expect(debug).toHaveBeenCalledWith(`Dispatching action. type:NULL_PAYLOAD, payload:null`);
  });

  // Verify that non-object actions (e.g., strings) are correctly logged
  it("should handle non-object actions", () => {
    const action = "STRING_ACTION";
    loggerMiddleware(mockStore)(mockNext)(action);

    expect(debug).toHaveBeenCalledWith(`Dispatching action. unknown type("STRING_ACTION")`);
  });

  // Verify that actions without a payload are correctly logged
  it("should handle actions without payload", () => {
    const action = { type: "NO_PAYLOAD" };
    loggerMiddleware(mockStore)(mockNext)(action);

    expect(debug).toHaveBeenCalledWith(
      `Dispatching action. unknown type(${JSON.stringify(action)})`,
    );
  });
});
