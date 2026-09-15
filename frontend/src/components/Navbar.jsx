import React from "react";
import { Shield, ShieldAlert, FileAudio, PhoneCall, Cpu } from "lucide-react";

export function Navbar({ activeMode, onModeChange, backendHealth }) {
  const isOnline = backendHealth?.status === "online";
  const device = backendHealth?.model?.device || "cpu";

  return (
    <header className="navbar-container">
      <div className="navbar-left">
        <div className="brand-logo">
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
            className={`mode-btn ${activeMode === "file" ? "active" : ""}`}
            onClick={() => onModeChange("file")}
          >
            <FileAudio size={18} />
            <span>Analyze Audio File</span>
          </button>
          <button
            className={`mode-btn ${activeMode === "live" ? "active" : ""}`}
            onClick={() => onModeChange("live")}
          >
            <PhoneCall size={18} />
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
