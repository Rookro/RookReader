import type { Theme } from "@mui/material/styles";

/**
 * Picks a readable text color for content drawn on top of `backgroundColor`.
 *
 * Tag colors are chosen by the user and stored as free-form strings, so a value that
 * MUI cannot parse would otherwise throw while rendering. Such a value falls back to
 * the theme's primary text color.
 *
 * @param theme - The active MUI theme.
 * @param backgroundColor - The background the text is drawn on, in any CSS color format MUI accepts.
 * @returns A color with sufficient contrast against `backgroundColor`.
 */
export const getReadableTextColor = (theme: Theme, backgroundColor: string): string => {
  try {
    return theme.palette.getContrastText(backgroundColor);
  } catch {
    return theme.palette.text.primary;
  }
};
