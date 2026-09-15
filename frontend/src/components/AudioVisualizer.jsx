import React, { useEffect, useRef } from "react";

export function AudioVisualizer({ stream, isMuted, color = "#10b981", height = 60 }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (!stream || isMuted || !canvasRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw flat idle line
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
      return;
    }

    let audioCtx;
    let analyser;
    let source;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtxClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const render = () => {
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;

          // Gradient fill
          const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
          grad.addColorStop(0, color);
          grad.addColorStop(1, "#38bdf8");

          ctx.fillStyle = grad;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

          x += barWidth;
        }

        animFrameRef.current = requestAnimationFrame(render);
      };

      render();
    } catch (err) {
      console.warn("Visualizer audio setup failed:", err);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (source) {
        try {
          source.disconnect();
        } catch (e) {}
      }
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch (e) {}
      }
    };
  }, [stream, isMuted, color]);

  return (
    <div className="audio-visualizer-wrapper">
      <canvas
        ref={canvasRef}
        width={300}
        height={height}
        className="audio-visualizer-canvas"
      />
    </div>
  );
}
