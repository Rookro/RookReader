import ControlSlider from "./components/ControlSlider/ControlSlider";
import ImageViewer from "./components/ImageViewer/ImageViewer";
import LeftPane from "./components/LeftPane/LeftPane";
import NavigationBar from "./components/NavigationBar/NavigationBar";
import "./App.css";

function App() {
  return (
    <main className="container">
      <NavigationBar />
      <div className="main_view">
        <LeftPane />
        <ImageViewer />
      </div>
      <ControlSlider />
    </main>
  );
}

export default App;
