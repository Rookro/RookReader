import "@mui/material/styles";

// https://mui.com/material-ui/customization/theming/#typescript
declare module "@mui/material/styles" {
  interface Theme {
    /** Custom scrollbar Properties */
    customScrollbar: {
      /** Width of the scrollbar */
      width: number;
      /** Height of the scrollbar */
      height: number;
    };
  }
  // allow configuration using `createTheme()`
  interface ThemeOptions {
    customScrollbar?: {
      width?: number;
      height?: number;
    };
  }
}
