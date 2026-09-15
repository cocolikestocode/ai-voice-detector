import { WS_BASE_URL } from "../config";

/**
 * Resamples a Float32Array from sourceSampleRate to targetSampleRate (16,000 Hz).
 * Uses linear interpolation for fast real-time audio downsampling in the browser.
 */
function resampleTo16k(inputData, sourceSampleRate, targetSampleRate = 16000) {
  if (sourceSampleRate === targetSampleRate) {
    return inputData;
  }
  const ratio = sourceSampleRate / targetSampleRate;
  const targetLength = Math.round(inputData.length / ratio);
  const result = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const srcIndex = i * ratio;
    const indexFloor = Math.floor(srcIndex);
    const indexCeil = Math.min(inputData.length - 1, indexFloor + 1);
    const fraction = srcIndex - indexFloor;
    result[i] = inputData[indexFloor] * (1 - fraction) + inputData[indexCeil] * fraction;
  }
  return result;
}

export class LiveDetectionClient {
  constructor({
    roomId,
    clientId,
    onChunkResult,
    onReady,
    onError
  }) {
    this.roomId = roomId;
    this.clientId = clientId;
    this.onChunkResult = onChunkResult || (() => {});
    this.onReady = onReady || (() => {});
    this.onError = onError || (() => {});

    this.ws = null;
    this.audioContext = null;
    this.mediaStreamSource = null;
    this.processorNode = null;
    this.isActive = false;
  }

  start(remoteStream) {
    if (!remoteStream) {
      console.warn("[LiveDetection] No remote stream provided for detection");
      return;
    }

    this.isActive = true;
    const wsUrl = `${WS_BASE_URL}/ws/detect/${this.roomId}/${this.clientId}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      console.log("[LiveDetection] Connected to detection pipeline");
      this.setupAudioProcessing(remoteStream);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "chunk_result") {
          this.onChunkResult(msg);
        } else if (msg.type === "detection_ready") {
          this.onReady(msg);
        }
      } catch (err) {
        console.error("[LiveDetection] Message parse error:", err);
      }
    };

    this.ws.onerror = (err) => {
      console.error("[LiveDetection] WebSocket error:", err);
      this.onError("Detection WebSocket error");
    };

    this.ws.onclose = () => {
      console.log("[LiveDetection] Detection connection closed");
    };
  }

  setupAudioProcessing(stream) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      const sourceSr = this.audioContext.sampleRate;

      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

      // Buffer size of 4096 gives low-latency periodic chunks (~85ms at 48kHz)
      const bufferSize = 4096;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputChannel = e.inputBuffer.getChannelData(0);
        // Downsample to 16,000 Hz float32
        const resampled = resampleTo16k(inputChannel, sourceSr, 16000);

        // Send binary PCM Float32 buffer
        this.ws.send(resampled.buffer);
      };

      // Connect nodes: mediaStreamSource -> processorNode -> destination (silent gain to avoid feedback)
      this.mediaStreamSource.connect(this.processorNode);
      // Connect to a mute destination so ScriptProcessor is clocked by the browser audio engine
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0;
      this.processorNode.connect(silentGain);
      silentGain.connect(this.audioContext.destination);

      console.log(`[LiveDetection] Audio processor active at ${sourceSr} Hz -> resampled to 16000 Hz`);
    } catch (err) {
      console.error("[LiveDetection] Error setting up audio processing:", err);
      this.onError(`Audio processing error: ${err.message}`);
    }
  }

  updateConfig(threshold, suspectedChunks, alertConsecutive) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "set_config",
        threshold,
        suspected_chunks: suspectedChunks,
        alert_consecutive: alertConsecutive
      }));
    }
  }

  stop() {
    this.isActive = false;

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch (e) {}
      this.processorNode = null;
    }

    if (this.mediaStreamSource) {
      try {
        this.mediaStreamSource.disconnect();
      } catch (e) {}
      this.mediaStreamSource = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
