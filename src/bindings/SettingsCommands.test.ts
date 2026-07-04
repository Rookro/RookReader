import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandError } from "../types/Error";
import * as SettingsCommands from "./SettingsCommands";

describe("SettingsCommands", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  const mockError = { code: 123, message: "Fail" };
  const mockSettings = { general: { theme: "system" } };

  it("getSettings should call invoke and return the settings", async () => {
    vi.mocked(invoke).mockResolvedValue(mockSettings);

    const result = await SettingsCommands.getSettings();

    expect(invoke).toHaveBeenCalledWith("get_settings");
    expect(result).toEqual(mockSettings);
  });

  it("getSettings should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(SettingsCommands.getSettings()).rejects.toThrow(CommandError);
  });

  it("setSettings should call invoke with the patch and return the merged settings", async () => {
    vi.mocked(invoke).mockResolvedValue(mockSettings);
    const patch = { bookshelf: { gridSize: 2 } } as never;

    const result = await SettingsCommands.setSettings(patch);

    expect(invoke).toHaveBeenCalledWith("set_settings", { patch });
    expect(result).toEqual(mockSettings);
  });

  it("setSettings should throw CommandError on failure", async () => {
    vi.mocked(invoke).mockRejectedValue(mockError);
    await expect(SettingsCommands.setSettings({} as never)).rejects.toThrow(CommandError);
  });
});
