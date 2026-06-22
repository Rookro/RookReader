import { createCommandError } from "../types/Error";
import { commands } from "./bindings";

/**
 * Gets fonts.
 *
 * @returns A promise that resolves to an array of font names.
 */
export const getFonts = async (): Promise<string[]> => {
  try {
    return await commands.getFonts();
  } catch (error) {
    throw createCommandError(error);
  }
};
