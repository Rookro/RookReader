import { createTheme, ThemeProvider, useMediaQuery } from "@mui/material";
import ControlSlider from "./components/ControlSlider/ControlSlider";
import ImageViewer from "./components/ImageViewer/ImageViewer";
import LeftPane from "./components/LeftPane/LeftPane";
import NavigationBar from "./components/NavigationBar/NavigationBar";
import "./App.css";

function App() {

  const theme = createTheme({
    palette: {
      mode: useMediaQuery('(prefers-color-scheme: dark)') ? 'dark' : 'light'
    }
  })

  return (
    <ThemeProvider theme={theme}>
      <main className="container">
        <NavigationBar />
        <div className="main_view">
          <LeftPane />
          <ImageViewer />
        </div>
        <ControlSlider />
      </main>
    </ThemeProvider>
  );
}

export default App;
