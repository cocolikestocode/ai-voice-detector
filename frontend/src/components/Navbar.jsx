import React from "react";
import { Shield, FileAudio, PhoneCall, Cpu, Home } from "lucide-react";

export function Navbar({ activeMode, onModeChange, backendHealth }) {
  const isOnline = backendHealth?.status === "online";
  const device = backendHealth?.model?.device || "cpu";

  return (
    <header className="navbar-container">
      <div className="navbar-left">
        <div 
          className="brand-logo brand-clickable" 
          onClick={() => onModeChange("landing")}
          title="Return to DeepFense Overview"
        >
          <Shield className="brand-icon" />
          <div>
            <div className="brand-title">DEEPFENSE <span className="brand-version">SIH26104</span></div>
            <div className="brand-subtitle">AI Voice Clone Detection System</div>
          </div>
        </div>
      </div>

      <div className="navbar-center">
        <nav className="mode-selector">
          <button
            className={`mode-btn ${activeMode === "landing" ? "active" : ""}`}
            onClick={() => onModeChange("landing")}
            title="Overview & Architecture"
          >
            <Home size={17} />
            <span>Overview</span>
          </button>
          <button
            className={`mode-btn ${activeMode === "file" ? "active" : ""}`}
            onClick={() => onModeChange("file")}
          >
            <FileAudio size={17} />
            <span>Analyze Audio File</span>
          </button>
          <button
            className={`mode-btn ${activeMode === "live" ? "active" : ""}`}
            onClick={() => onModeChange("live")}
          >
            <PhoneCall size={17} />
            <span>Secure Live Call</span>
          </button>
        </nav>
      </div>

      <div className="navbar-right">
        <div className="status-pill">
          <span className={`status-dot ${isOnline ? "online" : "offline"}`} />
          <span className="status-text">{isOnline ? "DeepFense Ready" : "Connecting..."}</span>
        </div>
        <div className="model-pill">
          <Cpu size={14} />
          <span>WavLM + AASIST ({device.toUpperCase()})</span>
        </div>
      </div>
    </header>
  );
}
