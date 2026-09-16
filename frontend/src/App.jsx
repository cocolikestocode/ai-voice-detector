import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./components/LandingPage";
import { FileAnalysis } from "./components/FileAnalysis";
import { LiveCall } from "./components/LiveCall";
import { API_BASE_URL } from "./config";

export function App() {
  const [activeMode, setActiveMode] = useState("landing"); // "landing", "file", or "live"
  const [backendHealth, setBackendHealth] = useState(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        if (res.ok) {
          const data = await res.json();
          setBackendHealth(data);
        } else {
          setBackendHealth({ status: "error" });
        }
      } catch (err) {
        setBackendHealth({ status: "offline" });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // Landing Page Mode
  if (activeMode === "landing") {
    return (
      <LandingPage
        onLaunch={(targetMode) => setActiveMode(targetMode || "file")}
        backendHealth={backendHealth}
      />
    );
  }

  // Detection Interface Console (File Analysis / Live Call)
  return (
    <div className="app-container">
      <Navbar
        activeMode={activeMode}
        onModeChange={setActiveMode}
        backendHealth={backendHealth}
      />

      <main className="main-content">
        {activeMode === "file" ? <FileAnalysis /> : <LiveCall />}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <span>Smart India Hackathon 2026 • Problem Statement: SIH26104</span>
          <span className="footer-divider">•</span>
          <span>DeepFense Architecture: WavLM-Large + AASIST</span>
          <span className="footer-divider">•</span>
          <span>Zero Audio Storage (Privacy First)</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
