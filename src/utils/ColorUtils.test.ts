import { createTheme } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { getReadableTextColor } from "./ColorUtils";

describe("getReadableTextColor", () => {
  const lightTheme = createTheme({ palette: { mode: "light" } });
  const darkTheme = createTheme({ palette: { mode: "dark" } });

  it("should return a dark color on a light background", () => {
    // Yellow 500, one of the selectable tag colors.
    expect(getReadableTextColor(lightTheme, "#FFEB3B")).toBe(lightTheme.palette.text.primary);
  });

  it("should return a light color on a dark background", () => {
    // Grey 900, the darkest selectable tag color.
    expect(getReadableTextColor(lightTheme, "#212121")).toBe("#fff");
  });

  it("should pick by background rather than by theme mode", () => {
    // A pale tag stays readable in dark mode, where the default text is light.
    expect(getReadableTextColor(darkTheme, "#FFEB3B")).not.toBe("#fff");
  });

  it("should fall back to the theme text color when the value cannot be parsed", () => {
    expect(getReadableTextColor(lightTheme, "not-a-color")).toBe(lightTheme.palette.text.primary);
  });

  it("should fall back when the stored value is empty", () => {
    expect(getReadableTextColor(lightTheme, "")).toBe(lightTheme.palette.text.primary);
  });
});
