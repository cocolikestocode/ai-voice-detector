import React from "react";
import {
  Shield,
  ShieldCheck,
  FileAudio,
  PhoneCall,
  Cpu,
  ArrowRight,
  Zap,
  Lock,
  Activity,
  CheckCircle2,
  Sparkles,
  Radio,
  Layers,
  ChevronRight,
  ExternalLink
} from "lucide-react";

export function LandingPage({ onLaunch, backendHealth }) {
  const isOnline = backendHealth?.status === "online";
  const device = backendHealth?.model?.device || "cpu";

  return (
    <div className="landing-container">
      {/* Background ambient glow elements */}
      <div className="landing-glow glow-1" />
      <div className="landing-glow glow-2" />

      {/* Top Header */}
      <header className="landing-header">
        <div className="landing-brand">
          <div className="brand-logo-wrap">
            <Shield className="landing-logo-icon" />
            <div className="brand-pulse-ring" />
          </div>
          <div>
            <div className="brand-title">
              DEEPFENSE <span className="brand-version">SIH26104</span>
            </div>
            <div className="brand-subtitle">AI Voice Clone Detection System</div>
          </div>
        </div>

        <div className="landing-header-right">
          <div className="landing-status-pill">
            <span className={`status-dot ${isOnline ? "online" : "offline"}`} />
            <span className="font-mono text-xs">
              {isOnline ? "Engine Ready" : "Backend Offline"}
            </span>
          </div>
          <button
            className="landing-launch-btn-sm"
            onClick={() => onLaunch("file")}
          >
            <span>Launch Console</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <Sparkles size={14} className="text-cyan" />
          <span>Smart India Hackathon 2026 • Problem Statement: SIH26104</span>
        </div>

        <h1 className="hero-title">
          Real-Time AI Voice Clone &amp; <br />
          <span className="gradient-text">Deepfake Voice Detection</span>
        </h1>

        <p className="hero-subtitle">
          Next-generation voice fraud defense powered by self-supervised speech
          representations (<strong>WavLM-Large</strong>) and spectral-temporal graph
          attention networks (<strong>AASIST</strong>). Built for forensic file analysis
          and zero-latency live WebRTC call protection.
        </p>

        {/* Primary Call To Action Button */}
        <div className="hero-cta-group">
          <button
            className="hero-main-cta"
            onClick={() => onLaunch("file")}
          >
            <div className="cta-content">
              <span className="cta-icon-wrap">
                <ShieldCheck size={22} />
              </span>
              <div className="cta-text">
                <span className="cta-title">Enter Detection Interface</span>
                <span className="cta-desc">Launch DeepFense Neural Console</span>
              </div>
            </div>
            <ArrowRight size={20} className="cta-arrow" />
          </button>

          <div className="hero-quick-modes">
            <button
              className="quick-mode-btn"
              onClick={() => onLaunch("file")}
            >
              <FileAudio size={16} className="text-cyan" />
              <span>Analyze Audio File</span>
              <ChevronRight size={14} />
            </button>
            <button
              className="quick-mode-btn"
              onClick={() => onLaunch("live")}
            >
              <PhoneCall size={16} className="text-emerald" />
              <span>Secure Live Call Mode</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Key Metrics / Highlights Bar */}
        <div className="hero-metrics-bar">
          <div className="metric-item">
            <span className="metric-value font-mono">16 kHz</span>
            <span className="metric-label">Acoustic Sampling</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-value font-mono">4.0s</span>
            <span className="metric-label">Window Resolution</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-value font-mono">&lt; 1.0s</span>
            <span className="metric-label">CPU Inference</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-value font-mono">0 Bytes</span>
            <span className="metric-label">Audio Retained</span>
          </div>
        </div>
      </section>

      {/* Two Core Detection Modes Grid */}
      <section className="landing-modes-section">
        <div className="section-header-center">
          <h2 className="section-title">Dual-Mode Voice Authenticity Engine</h2>
          <p className="section-desc">
            Designed to protect against voice fraud both in offline forensic workflows
            and during active live phone/browser calls.
          </p>
        </div>

        <div className="modes-grid">
          {/* Card 1: Mode 1 - File Analysis */}
          <div className="mode-feature-card">
            <div className="card-top-icon file-icon-theme">
              <FileAudio size={28} />
            </div>
            <div className="card-tag">Mode 1 • Offline Forensics</div>
            <h3 className="card-heading">Audio File Deepfake Analysis</h3>
            <p className="card-body">
              Upload pre-recorded audio files (WAV, MP3, FLAC, M4A). DeepFense slices
              the recording into sequential 4-second acoustic frames, scoring each
              segment to pinpoint the exact timestamps of synthetic voice tampering.
            </p>

            <ul className="card-bullets">
              <li>
                <CheckCircle2 size={16} className="bullet-icon text-cyan" />
                <span>Drag-and-drop file ingestion with waveform visualization</span>
              </li>
              <li>
                <CheckCircle2 size={16} className="bullet-icon text-cyan" />
                <span>Interactive chunk timeline breakdown (0-4s, 4-8s, etc.)</span>
              </li>
              <li>
                <CheckCircle2 size={16} className="bullet-icon text-cyan" />
                <span>Adjustable spoof score threshold &amp; chunk sensitivity</span>
              </li>
            </ul>

            <button
              className="card-action-btn file-theme"
              onClick={() => onLaunch("file")}
            >
              <span>Open File Analyzer</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Card 2: Mode 2 - Live Call */}
          <div className="mode-feature-card">
            <div className="card-top-icon live-icon-theme">
              <PhoneCall size={28} />
            </div>
            <div className="card-tag">Mode 2 • Real-Time Protection</div>
            <h3 className="card-heading">Encrypted WebRTC Live Call Shield</h3>
            <p className="card-body">
              Pure peer-to-peer browser voice calls over WebRTC. While participants speak,
              the recipient's audio pipeline streams downsampled 16 kHz buffers over a secure
              WebSocket to evaluate voice integrity in continuous 4-second blocks.
            </p>

            <ul className="card-bullets">
              <li>
                <CheckCircle2 size={16} className="bullet-icon text-emerald" />
                <span>Zero audio storage — evaluated in transient RAM and discarded</span>
              </li>
              <li>
                <CheckCircle2 size={16} className="bullet-icon text-emerald" />
                <span>Dynamic Risk Engine with immediate Clone Spoof alerts</span>
              </li>
              <li>
                <CheckCircle2 size={16} className="bullet-icon text-emerald" />
                <span>Full mobile &amp; Android support via secure HTTPS context</span>
              </li>
            </ul>

            <button
              className="card-action-btn live-theme"
              onClick={() => onLaunch("live")}
            >
              <span>Launch Live Call Console</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Neural Pipeline Architecture */}
      <section className="landing-pipeline-section">
        <div className="section-header-center">
          <div className="section-pill">
            <Cpu size={14} className="text-cyan" />
            <span>DeepFense Architecture</span>
          </div>
          <h2 className="section-title">How the Neural Engine Evaluates Authenticity</h2>
          <p className="section-desc">
            Combining self-supervised deep speech representations with spectral-temporal graph attention.
          </p>
        </div>

        <div className="pipeline-steps-grid">
          <div className="pipeline-step-card">
            <div className="step-number font-mono">01</div>
            <div className="step-icon-wrap">
              <Radio size={20} />
            </div>
            <h4 className="step-title">Audio Normalization</h4>
            <p className="step-text">
              Ingests live PCM or uploaded audio, resamples to 16 kHz mono, and segments into 4-second (64,000 samples) windows with repeat-padding.
            </p>
          </div>

          <div className="pipeline-step-card">
            <div className="step-number font-mono">02</div>
            <div className="step-icon-wrap">
              <Layers size={20} />
            </div>
            <h4 className="step-title">WavLM-Large SSL</h4>
            <p className="step-text">
              Extracts high-dimensional acoustic representations across 24 transformer layers, capturing micro-pitch artifacts and synthesis glitches.
            </p>
          </div>

          <div className="pipeline-step-card">
            <div className="step-number font-mono">03</div>
            <div className="step-icon-wrap">
              <Activity size={20} />
            </div>
            <h4 className="step-title">AASIST Graph Network</h4>
            <p className="step-text">
              Heterogeneous graph attention network (HS-GAL) model maps cross-temporal and spectral graph dependencies to detect synthetic voice markers.
            </p>
          </div>

          <div className="pipeline-step-card">
            <div className="step-number font-mono">04</div>
            <div className="step-icon-wrap">
              <Zap size={20} />
            </div>
            <h4 className="step-title">Risk Engine &amp; Alert</h4>
            <p className="step-text">
              Compares logit scores against authoritative threshold (1.0). Dispatches bonafide/spoof ratings and triggers defensive warnings.
            </p>
          </div>
        </div>
      </section>

      {/* Security & System Features */}
      <section className="landing-features-strip">
        <div className="strip-grid">
          <div className="strip-item">
            <div className="strip-icon">
              <Lock size={20} className="text-cyan" />
            </div>
            <div>
              <h5 className="strip-title">Privacy-First (Zero Storage)</h5>
              <p className="strip-desc">
                Transient in-memory processing. Raw audio is never saved to disk or server databases.
              </p>
            </div>
          </div>

          <div className="strip-item">
            <div className="strip-icon">
              <Zap size={20} className="text-emerald" />
            </div>
            <div>
              <h5 className="strip-title">Optimized PyTorch Pipeline</h5>
              <p className="strip-desc">
                Preloaded once at startup. Evaluates 4s chunks in ~0.93s on CPU, or ~80ms on GPU.
              </p>
            </div>
          </div>

          <div className="strip-item">
            <div className="strip-icon">
              <ShieldCheck size={20} className="text-blue" />
            </div>
            <div>
              <h5 className="strip-title">ASVspoof5 Calibrated</h5>
              <p className="strip-desc">
                Fine-tuned checkpoint evaluated on state-of-the-art synthetic voice attack benchmarks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="landing-bottom-cta">
        <div className="bottom-cta-box">
          <div className="bottom-cta-text">
            <h2>Ready to Test Voice Authenticity?</h2>
            <p>
              Launch the detection interface now to test audio files or start a live encrypted WebRTC call.
            </p>
          </div>
          <button
            className="bottom-cta-btn"
            onClick={() => onLaunch("file")}
          >
            <span>Launch Interface Now</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <span>Smart India Hackathon 2026 • Problem Statement: SIH26104</span>
          <span className="footer-divider">•</span>
          <span>DeepFense Voice Clone Defense Engine</span>
          <span className="footer-divider">•</span>
          <span>WavLM-Large + AASIST</span>
        </div>
      </footer>
    </div>
  );
}
