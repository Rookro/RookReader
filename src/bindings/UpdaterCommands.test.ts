import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";
import { isUpdaterSupported } from "./UpdaterCommands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("UpdaterCommands", () => {
  describe("isUpdaterSupported", () => {
    it("should call the correct tauri command and return its result", async () => {
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await isUpdaterSupported();

      expect(invoke).toHaveBeenCalledWith("is_updater_supported");
      expect(result).toBe(true);
    });

    it("should handle false result", async () => {
      vi.mocked(invoke).mockResolvedValue(false);

      const result = await isUpdaterSupported();

      expect(invoke).toHaveBeenCalledWith("is_updater_supported");
      expect(result).toBe(false);
    });
  });
});
