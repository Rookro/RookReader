import { invoke } from "@tauri-apps/api/core";

/**
 * Gets fonts.
 *
 * @returns A promise that resolves to an array of font names.
 */
export const getFonts = async (): Promise<string[]> => {
  return invoke<string[]>("get_fonts");
};
