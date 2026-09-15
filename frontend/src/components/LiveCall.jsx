import React, { useState, useEffect, useRef } from "react";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  ShieldCheck, 
  ShieldAlert, 
  AlertOctagon, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  Users, 
  Clock, 
  Activity, 
  Layers, 
  Sliders, 
  Settings2 
} from "lucide-react";
import { WebRTCService } from "../services/webrtc";
import { LiveDetectionClient } from "../services/audioCapture";
import { AudioVisualizer } from "./AudioVisualizer";

export function LiveCall() {
  const [roomId, setRoomId] = useState("sih-room-1");
  const [clientId] = useState(() => "user-" + Math.random().toString(36).substring(2, 7));
  const [isInCall, setIsInCall] = useState(false);
  const [connState, setConnState] = useState("IDLE");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [error, setError] = useState(null);

  // Live audio streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // Configurable thresholds
  const [threshold, setThreshold] = useState(1.0);
  const [suspectedChunks, setSuspectedChunks] = useState(1);
  const [alertConsecutive, setAlertConsecutive] = useState(2);

  // Live detection & risk state
  const [chunkHistory, setChunkHistory] = useState([]);
  const [riskState, setRiskState] = useState({
    status: "INITIALIZING",
    risk_level: "LOW",
    title: "Awaiting Live Voice",
    description: "Connect to a room and speak into microphone to begin real-time analysis.",
    badge_color: "gray"
  });
  const [sessionSummary, setSessionSummary] = useState({
    total_chunks: 0,
    spoof_chunks: 0,
    bonafide_chunks: 0,
    consecutive_spoof: 0,
    latest_score: null,
    lowest_score: null
  });

  const isMediaDevicesSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const webrtcRef = useRef(null);
  const detectionRef = useRef(null);
  const timerRef = useRef(null);

  // Call duration counter
  useEffect(() => {
    if (isInCall && connState === "CONNECTED") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isInCall, connState]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartCall = async () => {
    setError(null);
    setChunkHistory([]);
    setCallDuration(0);

    // Pre-flight check for microphone support in this browser context
    if (!isMediaDevicesSupported) {
      if (!isHttps && !isLocalhost) {
        setError("Microphone requires HTTPS when accessing this app from another device. Open the HTTPS development URL.");
      } else {
        setError("Microphone API (navigator.mediaDevices.getUserMedia) is not supported in this browser context.");
      }
      return;
    }

    // 1. Initialize WebRTC peer service
    const rtc = new WebRTCService({
      roomId,
      clientId,
      onConnectionStateChange: (st) => {
        setConnState(st);
        if (st === "CONNECTED") {
          setPeerCount(1);
        } else if (st === "PEER_DISCONNECTED") {
          setPeerCount(0);
        }
      },
      onLocalStreamReady: (stream) => {
        setLocalStream(stream);
      },
      onRemoteStream: (stream) => {
        console.log("[LiveCall] Remote voice stream attached. Initializing transient detection...");
        setRemoteStream(stream);

        // 2. Attach transient detection pipeline to remote stream
        const det = new LiveDetectionClient({
          roomId,
          clientId,
          onChunkResult: (data) => {
            console.log("[LiveCall] Chunk received:", data);
            setChunkHistory((prev) => [data.chunk, ...prev]);
            setRiskState(data.risk_state);
            setSessionSummary(data.session_summary);
          },
          onError: (err) => setError(`Detection error: ${err}`)
        });

        detectionRef.current = det;
        det.start(stream);
      },
      onPeerJoined: (pid) => {
        console.log(`[LiveCall] Peer joined: ${pid}`);
        setPeerCount((prev) => prev + 1);
      },
      onPeerLeft: (pid) => {
        console.log(`[LiveCall] Peer left: ${pid}`);
        setPeerCount(0);
        setRemoteStream(null);
      },
      onError: (err) => setError(err)
    });

    webrtcRef.current = rtc;
    setIsInCall(true);
    await rtc.start();
  };

  const handleEndCall = () => {
    if (detectionRef.current) {
      detectionRef.current.stop();
      detectionRef.current = null;
    }
    if (webrtcRef.current) {
      webrtcRef.current.stop();
      webrtcRef.current = null;
    }
    setIsInCall(false);
    setLocalStream(null);
    setRemoteStream(null);
    setConnState("ENDED");
    setPeerCount(0);
  };

  const handleToggleMute = () => {
    if (webrtcRef.current) {
      const muted = webrtcRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateThresholdConfig = (newThreshold, newSuspected, newConsecutive) => {
    setThreshold(newThreshold);
    setSuspectedChunks(newSuspected);
    setAlertConsecutive(newConsecutive);
    if (detectionRef.current) {
      detectionRef.current.updateConfig(newThreshold, newSuspected, newConsecutive);
    }
  };

  return (
    <div className="live-call-container">
      <div className="section-header">
        <div>
          <h2 className="section-title">Mode 2: Real-Time Browser-to-Browser Call</h2>
          <p className="section-desc">
            Direct peer-to-peer WebRTC voice call with continuous 4-second transient DeepFense analysis and live Voice Integrity risk monitoring.
          </p>
        </div>
      </div>

      <div className="live-call-layout">
        {/* Left Column: Call Room & Audio HUD */}
        <div className="call-control-column">
          {/* Room Setup / Call Status Card */}
          <div className="panel-card call-panel">
            {!isHttps && !isLocalhost && (
              <div className="https-warning-banner">
                <AlertOctagon size={22} className="text-amber-400 shrink-0" />
                <div className="https-warning-body">
                  <div className="https-warning-title">HTTPS Required for Microphone Access</div>
                  <div className="https-warning-desc">
                    Modern browsers (Android Chrome, iOS Safari) restrict microphone access on plain HTTP when accessed over a LAN IP. Open the secure HTTPS development server:
                  </div>
                  <a
                    href={`https://${window.location.host}`}
                    className="btn-switch-https"
                  >
                    Switch to https://{window.location.host}
                  </a>
                </div>
              </div>
            )}

            {!isInCall ? (
              <div className="room-setup-box">
                <div className="input-group">
                  <label className="input-label">Call Room Identifier</label>
                  <div className="input-row">
                    <input
                      type="text"
                      className="text-input font-mono"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value.trim().toLowerCase())}
                      placeholder="e.g. secure-room-1"
                    />
                    <button
                      className="btn-secondary"
                      onClick={() => setRoomId(`room-${Math.floor(1000 + Math.random() * 9000)}`)}
                    >
                      Generate
                    </button>
                  </div>
                  <span className="input-hint">Enter the same Room ID on a second browser tab or machine to connect.</span>
                </div>

                <button className="btn-primary btn-call-start" onClick={handleStartCall}>
                  <Phone size={18} />
                  <span>Launch Secure Voice Call</span>
                </button>
              </div>
            ) : (
              <div className="active-call-hud">
                <div className="call-status-row">
                  <div className="call-badge-item">
                    <span className="call-status-dot pulse" />
                    <span className="font-mono text-sm uppercase">{connState.replace(/_/g, " ")}</span>
                  </div>
                  <div className="call-timer font-mono">
                    <Clock size={16} />
                    <span>{formatTime(callDuration)}</span>
                  </div>
                  <div className="call-room-tag font-mono">
                    <span>Room: {roomId}</span>
                    <button className="btn-icon" onClick={copyRoomLink} title="Copy Room ID">
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Peer Audio Visualizers */}
                <div className="streams-grid">
                  <div className="stream-box local-stream">
                    <div className="stream-header">
                      <div className="stream-label">
                        <Mic size={14} /> Local Participant ({clientId})
                      </div>
                      <span className={`audio-pill ${isMuted ? "muted" : "active"}`}>
                        {isMuted ? "Muted" : "Active Mic"}
                      </span>
                    </div>
                    <AudioVisualizer stream={localStream} isMuted={isMuted} color="#10b981" height={45} />
                  </div>

                  <div className="stream-box remote-stream">
                    <div className="stream-header">
                      <div className="stream-label">
                        <Volume2 size={14} /> Remote Participant Voice
                      </div>
                      <span className={`audio-pill ${remoteStream ? "active" : "waiting"}`}>
                        {remoteStream ? "Receiving Audio" : "Waiting for Peer"}
                      </span>
                    </div>
                    <AudioVisualizer stream={remoteStream} isMuted={!remoteStream} color="#38bdf8" height={45} />
                  </div>
                </div>

                {/* Call Control Buttons */}
                <div className="call-actions-row">
                  <button
                    className={`btn-action ${isMuted ? "btn-muted" : "btn-unmuted"}`}
                    onClick={handleToggleMute}
                  >
                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
                  </button>

                  <button className="btn-action btn-hangup" onClick={handleEndCall}>
                    <PhoneOff size={18} />
                    <span>End Voice Call</span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="error-alert mt-4">
                <AlertOctagon size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Model & Application Risk Policy Settings */}
          <div className="panel-card policy-panel">
            <h4 className="panel-subtitle">
              <Settings2 size={16} /> Detection Thresholds & Risk Policy
            </h4>

            <div className="control-item">
              <div className="control-label-row">
                <span className="control-title">Authoritative Spoof Threshold</span>
                <span className="control-badge font-mono">{threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="4.0"
                step="0.1"
                value={threshold}
                onChange={(e) => updateThresholdConfig(parseFloat(e.target.value), suspectedChunks, alertConsecutive)}
                className="range-slider"
              />
              <div className="slider-hints">
                <span>Score &lt; {threshold.toFixed(2)} = Spoof</span>
                <span>Score ≥ {threshold.toFixed(2)} = Bonafide</span>
              </div>
            </div>

            <div className="control-item">
              <div className="control-label-row">
                <span className="control-title">Policy: Chunks for "Suspected"</span>
                <span className="control-badge font-mono">{suspectedChunks} chunk(s)</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={suspectedChunks}
                onChange={(e) => updateThresholdConfig(threshold, parseInt(e.target.value), alertConsecutive)}
                className="range-slider"
              />
              <span className="slider-subtext">Triggers Synthetic Voice Suspected state</span>
            </div>

            <div className="control-item">
              <div className="control-label-row">
                <span className="control-title">Policy: Consecutive for "Critical Alert"</span>
                <span className="control-badge font-mono">{alertConsecutive} consecutive</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={alertConsecutive}
                onChange={(e) => updateThresholdConfig(threshold, suspectedChunks, parseInt(e.target.value))}
                className="range-slider"
              />
              <span className="slider-subtext">Triggers AI Voice Clone Detected critical alert</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Detection HUD & Risk Engine */}
        <div className="detection-hud-column">
          {/* Risk Engine Status Banner */}
          <div className={`risk-banner risk-${riskState.risk_level.toLowerCase()}`}>
            <div className="risk-icon-box">
              {riskState.risk_level === "NORMAL" && <ShieldCheck size={36} className="text-emerald-400" />}
              {riskState.risk_level === "HIGH" && <ShieldAlert size={36} className="text-amber-400" />}
              {riskState.risk_level === "CRITICAL" && <AlertOctagon size={36} className="text-red-500 animate-pulse" />}
              {riskState.risk_level === "LOW" && <Activity size={36} className="text-slate-400" />}
            </div>
            <div className="risk-text-box">
              <div className="risk-level-tag">VOICE INTEGRITY RISK: {riskState.risk_level}</div>
              <div className="risk-title">{riskState.title}</div>
              <div className="risk-desc">{riskState.description}</div>
            </div>
          </div>

          {/* Session Statistics Bar */}
          <div className="live-metrics-grid">
            <div className="metric-box">
              <div className="metric-label">Analyzed Segments</div>
              <div className="metric-value font-mono text-cyan-400">{sessionSummary.total_chunks}</div>
              <div className="metric-sub">4-second windows</div>
            </div>

            <div className="metric-box">
              <div className="metric-label">Spoof Count</div>
              <div className={`metric-value font-mono ${sessionSummary.spoof_chunks > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {sessionSummary.spoof_chunks}
              </div>
              <div className="metric-sub">Consecutive: {sessionSummary.consecutive_spoof}</div>
            </div>

            <div className="metric-box">
              <div className="metric-label">Latest Score</div>
              <div className={`metric-value font-mono ${sessionSummary.latest_score !== null ? (sessionSummary.latest_score >= threshold ? "text-emerald-400" : "text-red-400") : "text-slate-400"}`}>
                {sessionSummary.latest_score !== null ? sessionSummary.latest_score.toFixed(4) : "—"}
              </div>
              <div className="metric-sub">Threshold: {threshold.toFixed(2)}</div>
            </div>

            <div className="metric-box">
              <div className="metric-label">Lowest Score</div>
              <div className={`metric-value font-mono ${sessionSummary.lowest_score !== null ? (sessionSummary.lowest_score >= threshold ? "text-emerald-400" : "text-red-400") : "text-slate-400"}`}>
                {sessionSummary.lowest_score !== null ? sessionSummary.lowest_score.toFixed(4) : "—"}
              </div>
              <div className="metric-sub">Session minimum</div>
            </div>
          </div>

          {/* Scrolling Live Chunk Evaluation Timeline */}
          <div className="panel-card live-timeline-card">
            <div className="live-timeline-header">
              <h4 className="panel-subtitle">
                <Layers size={16} /> Real-Time 4-Second Voice Segment Stream
              </h4>
              <span className="live-pill">
                <span className="live-dot" /> LIVE STREAM
              </span>
            </div>

            {chunkHistory.length === 0 ? (
              <div className="empty-chunks-box">
                <Activity size={32} className="text-slate-500" />
                <p>Waiting for remote voice data... Once speech starts, 4-second audio chunks will be analyzed and displayed here in real time.</p>
              </div>
            ) : (
              <div className="live-chunks-scroll">
                {chunkHistory.map((chk) => (
                  <div
                    key={chk.chunk_index}
                    className={`live-chunk-row ${chk.label === "bonafide" ? "row-bonafide" : "row-spoof"}`}
                  >
                    <div className="row-cell-idx font-mono">#{chk.chunk_index + 1}</div>
                    <div className="row-cell-time font-mono">
                      {chk.start_time.toFixed(1)}s – {chk.end_time.toFixed(1)}s
                    </div>
                    <div className="row-cell-score font-mono">
                      Score: <span className={chk.label === "bonafide" ? "text-emerald-400" : "text-red-400"}>{chk.score.toFixed(4)}</span>
                    </div>
                    <div className="row-cell-badge">
                      <span className={`chunk-badge ${chk.label === "bonafide" ? "badge-bonafide" : "badge-spoof"}`}>
                        {chk.label.toUpperCase()}
                      </span>
                    </div>
                    <div className="row-cell-latency font-mono text-slate-400">
                      {chk.inference_time_ms} ms
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
