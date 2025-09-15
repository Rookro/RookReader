import "./App.css";
import ImageViewer from "./components/ImageViewer/ImageViewer";
import LeftPane from "./components/LeftPane/LeftPane";
import NavigationBar from "./components/NavigationBar/NavigationBar";

function App() {
  return (
    <main className="container">
      <NavigationBar />
      <div className="main_view">
        <LeftPane />
        <ImageViewer />
      </div>
    </main>
  );
}

export default App;
