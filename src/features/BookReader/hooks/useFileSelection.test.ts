import { basename } from "@tauri-apps/api/path";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileSelection } from "./useFileSelection";

describe("useFileSelection", () => {
  const setSelectedName = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should select nothing if no book is open", async () => {
    renderHook(() => useFileSelection([], 0, setSelectedName));
    await waitFor(() => {
      expect(setSelectedName).toHaveBeenCalledWith(null);
    });
  });

  it("should select the open book by its file name", async () => {
    vi.mocked(basename).mockResolvedValue("file2.zip");
    renderHook(() => useFileSelection(["/path/to/file2.zip"], 0, setSelectedName));

    await waitFor(() => {
      expect(setSelectedName).toHaveBeenCalledWith("file2.zip");
    });
  });
});
