import React, { useState, useRef } from "react";
import { 
  Upload, 
  FileAudio, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Sliders, 
  Sparkles, 
  Activity,
  ArrowRight
} from "lucide-react";
import { API_BASE_URL } from "../config";

export function FileAnalysis() {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [threshold, setThreshold] = useState(1.0);
  const [minSpoofChunks, setMinSpoofChunks] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processSelectedFile(selected);
    }
  };

  const processSelectedFile = (selected) => {
    setFile(selected);
    setError(null);
    setResult(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    const url = URL.createObjectURL(selected);
    setAudioUrl(url);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("threshold", threshold.toString());
    formData.append("min_spoof_chunks", minSpoofChunks.toString());

    try {
      const res = await fetch(`${API_BASE_URL}/api/detect/file`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errData.detail || "Analysis request failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to analyze audio file");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="file-analysis-container">
      <div className="section-header">
        <div>
          <h2 className="section-title">Mode 1: Audio File Analysis</h2>
          <p className="section-desc">
            Upload voice recordings for high-precision segment-by-segment authenticity scoring via DeepFense (WavLM-Large + AASIST).
          </p>
        </div>
      </div>

      <div className="file-layout-grid">
        {/* Left Column: Upload & Parameters */}
        <div className="panel-card upload-panel">
          <div
            className={`dropzone ${file ? "has-file" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="audio/*"
              style={{ display: "none" }}
            />
            <div className="dropzone-content">
              <div className="dropzone-icon-ring">
                <Upload className="dropzone-icon" />
              </div>
              {file ? (
                <div className="file-info-preview">
                  <FileAudio className="file-icon" />
                  <div>
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || "Audio File"}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="dropzone-text-primary">Click to browse or drop voice recording</div>
                  <div className="dropzone-text-secondary">Supported: WAV, MP3, FLAC, OGG, M4A, WEBM</div>
                </div>
              )}
            </div>
          </div>

          {audioUrl && (
            <div className="audio-player-wrapper">
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
              />
              <button className="btn-play-pause" onClick={togglePlayback}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                <span>{isPlaying ? "Pause Preview" : "Play Preview"}</span>
              </button>
            </div>
          )}

          {/* Model & Policy Controls */}
          <div className="controls-box">
            <div className="control-item">
              <div className="control-label-row">
                <span className="control-title">
                  <Sliders size={14} /> Spoof Score Threshold
                </span>
                <span className="control-badge font-mono">{threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="4.0"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="range-slider"
              />
              <div className="slider-hints">
                <span>-2.0 (Strict Real)</span>
                <span>Default: 1.0</span>
                <span>+4.0 (Strict Fake)</span>
              </div>
            </div>

            <div className="control-item">
              <div className="control-label-row">
                <span className="control-title">
                  <Layers size={14} /> Min Spoof Chunks for File Spoof
                </span>
                <span className="control-badge font-mono">{minSpoofChunks}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={minSpoofChunks}
                onChange={(e) => setMinSpoofChunks(parseInt(e.target.value))}
                className="range-slider"
              />
              <div className="slider-hints">
                <span>1 Chunk (Default)</span>
                <span>Flag file if ≥ {minSpoofChunks} chunk(s) spoof</span>
              </div>
            </div>
          </div>

          <button
            className="btn-primary btn-analyze"
            onClick={handleAnalyze}
            disabled={!file || isLoading}
          >
            {isLoading ? (
              <span className="spinner-text">
                <span className="spinner" /> Analyzing Voice Segments...
              </span>
            ) : (
              <span>Run DeepFense Verification</span>
            )}
          </button>

          {error && (
            <div className="error-alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right Column: Results & Timeline */}
        <div className="panel-card results-panel">
          {!result && !isLoading && (
            <div className="empty-results-state">
              <Activity className="empty-icon" />
              <h3>Awaiting Audio Analysis</h3>
              <p>Upload an audio file and click "Run DeepFense Verification" to view segment scores, timeline visualization, and overall voice authenticity verdict.</p>
            </div>
          )}

          {isLoading && (
            <div className="loading-results-state">
              <div className="pulse-loader" />
              <h3>Processing in DeepFense...</h3>
              <p>Resampling to 16 kHz • Slicing 4-second chunks • Running WavLM-Large frontend & AASIST backend</p>
            </div>
          )}

          {result && (
            <div className="results-content">
              {/* Overall Verdict Banner */}
              <div className={`verdict-banner ${result.overall_label === "bonafide" ? "verdict-bonafide" : "verdict-spoof"}`}>
                <div className="verdict-icon-container">
                  {result.overall_label === "bonafide" ? (
                    <CheckCircle2 size={36} className="text-emerald-400" />
                  ) : (
                    <AlertTriangle size={36} className="text-red-400" />
                  )}
                </div>
                <div className="verdict-details">
                  <div className="verdict-tag">FINAL EVALUATION</div>
                  <div className="verdict-title">
                    {result.overall_label === "bonafide" ? "AUTHENTIC HUMAN VOICE" : "SYNTHETIC VOICE / SPOOF DETECTED"}
                  </div>
                  <div className="verdict-desc">
                    {result.overall_label === "bonafide"
                      ? "All analyzed segments meet the voice authenticity threshold."
                      : `${result.spoof_chunk_count} chunk(s) exhibited synthetic / cloned voice artifacts.`}
                  </div>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="metrics-grid">
                <div className="metric-box">
                  <div className="metric-label">Overall Score</div>
                  <div className={`metric-value font-mono ${result.overall_score >= result.threshold ? "text-emerald-400" : "text-red-400"}`}>
                    {result.overall_score.toFixed(4)}
                  </div>
                  <div className="metric-sub">Threshold: {result.threshold}</div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Audio Duration</div>
                  <div className="metric-value font-mono text-cyan-400">
                    {result.duration_seconds}s
                  </div>
                  <div className="metric-sub">{result.num_chunks} chunk(s) (4s each)</div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Spoof Segments</div>
                  <div className={`metric-value font-mono ${result.spoof_chunk_count > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {result.spoof_chunk_count} / {result.num_chunks}
                  </div>
                  <div className="metric-sub">Bonafide: {result.bonafide_chunk_count}</div>
                </div>

                <div className="metric-box">
                  <div className="metric-label">Inference Time</div>
                  <div className="metric-value font-mono text-slate-300">
                    {result.total_processing_time_ms} ms
                  </div>
                  <div className="metric-sub">In-process PyTorch</div>
                </div>
              </div>

              {/* Segment Timeline Breakdown */}
              <div className="timeline-section">
                <h4 className="timeline-title">
                  <Layers size={16} /> 4-Second Segment Analysis Breakdown
                </h4>
                <div className="chunks-list">
                  {result.chunks.map((chk) => (
                    <div
                      key={chk.chunk_index}
                      className={`chunk-card ${chk.label === "bonafide" ? "chunk-bonafide" : "chunk-spoof"}`}
                    >
                      <div className="chunk-header">
                        <span className="chunk-index font-mono">Chunk #{chk.chunk_index + 1}</span>
                        <span className="chunk-time font-mono">
                          {chk.start_time.toFixed(1)}s - {chk.end_time.toFixed(1)}s
                        </span>
                      </div>
                      <div className="chunk-body">
                        <div className="chunk-score-row">
                          <span className="chunk-score-label">DeepFense Score:</span>
                          <span className={`chunk-score-val font-mono ${chk.label === "bonafide" ? "text-emerald-400" : "text-red-400"}`}>
                            {chk.score.toFixed(4)}
                          </span>
                        </div>
                        <div className="chunk-status-row">
                          <span className={`chunk-badge ${chk.label === "bonafide" ? "badge-bonafide" : "badge-spoof"}`}>
                            {chk.label.toUpperCase()}
                          </span>
                          <span className="chunk-latency font-mono">{chk.inference_time_ms} ms</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
