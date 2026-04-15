import { basename } from "@tauri-apps/api/path";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileSelection } from "./useFileSelection";

describe("useFileSelection", () => {
  const setSelectedIndex = vi.fn();
  const mockEntries = [
    { name: "file1.zip", is_directory: false, last_modified: "" },
    { name: "file2.zip", is_directory: false, last_modified: "" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Verify that the selected index is set to -1 if there is no current file
  it("should set selected index to -1 if no current file", async () => {
    renderHook(() => useFileSelection([], 0, mockEntries, setSelectedIndex));
    await waitFor(() => {
      expect(setSelectedIndex).toHaveBeenCalledWith(-1);
    });
  });

  // Verify that the correct index is selected based on the file basename
  it("should set correct index based on basename", async () => {
    vi.mocked(basename).mockResolvedValue("file2.zip");
    renderHook(() => useFileSelection(["/path/to/file2.zip"], 0, mockEntries, setSelectedIndex));

    await waitFor(() => {
      expect(setSelectedIndex).toHaveBeenCalledWith(1);
    });
  });
});
