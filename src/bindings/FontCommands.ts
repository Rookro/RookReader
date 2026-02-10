import { invoke } from "@tauri-apps/api/core";
import { createCommandError } from "../types/Error";

/**
 * Gets fonts.
 *
 * @returns A promise that resolves to an array of font names.
 */
export const getFonts = async (): Promise<string[]> => {
  try {
    return await invoke<string[]>("get_fonts");
  } catch (error) {
    throw createCommandError(error);
  }
};
