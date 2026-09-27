import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createBasePreloadedState, createTestWrapper } from "../../../test/utils";
import { isTextEntryTarget, useReaderKeydown } from "./useReaderKeydown";

describe("useReaderKeydown", () => {
  const renderWithView = (activeView: "reader" | "bookshelf") => {
    const handler = vi.fn();
    const preloadedState = createBasePreloadedState();
    preloadedState.view.activeView = activeView;
    renderHook(() => useReaderKeydown(handler), { wrapper: createTestWrapper({ preloadedState }) });
    return handler;
  };

  it("delivers a key press while the reader view is active", () => {
    const handler = renderWithView("reader");
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores every key press while the bookshelf view is active", () => {
    const handler = renderWithView("bookshelf");
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores a key press typed into a text field", () => {
    const handler = renderWithView("reader");
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: " " });
    expect(handler).not.toHaveBeenCalled();
    input.remove();
  });

  it("stops listening once the hook unmounts", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useReaderKeydown(handler), {
      wrapper: createTestWrapper(),
    });
    unmount();
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("isTextEntryTarget", () => {
  it("recognises inputs, text areas and editable elements", () => {
    const editable = document.createElement("div");
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(isTextEntryTarget(document.createElement("input"))).toBe(true);
    expect(isTextEntryTarget(document.createElement("textarea"))).toBe(true);
    expect(isTextEntryTarget(editable)).toBe(true);
  });

  it("treats anything else as the reader's", () => {
    expect(isTextEntryTarget(document.body)).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });
});
