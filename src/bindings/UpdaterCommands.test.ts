import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";
import { claimUpdatePrompt, isUpdaterSupported, releaseUpdatePrompt } from "./UpdaterCommands";

vi.unmock("./UpdaterCommands");

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

  describe("claimUpdatePrompt", () => {
    it("asks the backend whether this window may show the update dialog", async () => {
      vi.mocked(invoke).mockResolvedValue(false);

      expect(await claimUpdatePrompt()).toBe(false);
      expect(invoke).toHaveBeenCalledWith("claim_update_prompt");
    });
  });

  describe("releaseUpdatePrompt", () => {
    it("tells the backend this window no longer shows the update dialog", async () => {
      vi.mocked(invoke).mockResolvedValue(null);

      await releaseUpdatePrompt();
      expect(invoke).toHaveBeenCalledWith("release_update_prompt");
    });
  });
});
