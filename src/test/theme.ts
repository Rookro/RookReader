import { createTheme } from "@mui/material";

/** The theme tests render under, with the app's scrollbar size, which `BookGrid` reads. */
export const testTheme = createTheme({ customScrollbar: { width: 10, height: 10 } });
