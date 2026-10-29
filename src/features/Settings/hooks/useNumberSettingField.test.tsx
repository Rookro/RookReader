import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockTauri } from "../../../test/mocks/tauri";
import {
  createBasePreloadedState,
  createTestWrapper,
  mockSettingsCommands,
} from "../../../test/utils";
import { useNumberSettingField } from "./useNumberSettingField";

const path = "reader.comic.cache.preloadPageCount";

function renderField() {
  const preloadedState = createBasePreloadedState();
  preloadedState.settings.reader.comic.cache.preloadPageCount = 15;
  return renderHook(() => useNumberSettingField(path), {
    wrapper: createTestWrapper({ preloadedState }),
  });
}

describe("useNumberSettingField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("gives the stored value and the field's bounds", () => {
    const { result } = renderField();
    expect(result.current).toMatchObject({ defaultValue: 15, min: 0, max: 10000, error: false });
  });

  it("saves a committed value at the field's path", async () => {
    const { result } = renderField();
    await act(() => result.current.onValueCommitted(20));
    expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
      patch: { reader: { comic: { cache: { preloadPageCount: 20 } } } },
    });
  });

  it("saves the field's default when the field is cleared", async () => {
    const { result } = renderField();
    await act(() => result.current.onValueCommitted(null));
    await waitFor(() =>
      expect(mockTauri.invoke).toHaveBeenCalledWith("set_settings", {
        patch: { reader: { comic: { cache: { preloadPageCount: 10 } } } },
      }),
    );
  });
});
