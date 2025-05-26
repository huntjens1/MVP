import BackendHealth from "./components/BackendHealth";
import LiveTranscribe from "./components/LiveTranscribe";

function App() {
  return (
    <div style={{ padding: 32 }}>
      <h1>CallLogix MVP</h1>
      <BackendHealth />
      <LiveTranscribe />
    </div>
  );
}

export default App;
