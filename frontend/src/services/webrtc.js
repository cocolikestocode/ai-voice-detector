import { WS_BASE_URL } from "../config";

export class WebRTCService {
  constructor({
    roomId,
    clientId,
    onConnectionStateChange,
    onRemoteStream,
    onPeerJoined,
    onPeerLeft,
    onError,
    onLocalStreamReady
  }) {
    this.roomId = roomId;
    this.clientId = clientId;
    this.onConnectionStateChange = onConnectionStateChange || (() => {});
    this.onRemoteStream = onRemoteStream || (() => {});
    this.onPeerJoined = onPeerJoined || (() => {});
    this.onPeerLeft = onPeerLeft || (() => {});
    this.onError = onError || (() => {});
    this.onLocalStreamReady = onLocalStreamReady || (() => {});

    this.ws = null;
    this.localStream = null;
    this.peerConnections = {}; // peerId -> RTCPeerConnection
    this.iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    this.isMuted = false;
    this.isCallActive = false;
  }

  async start() {
    this.isCallActive = true;
    this.onConnectionStateChange("REQUESTING_MICROPHONE");

    // 1. Pre-flight validation: check if mediaDevices and getUserMedia are supported in current context
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      const isHttps = window.location.protocol === "https:";
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      
      const errorMsg = (!isHttps && !isLocal)
        ? "Microphone requires HTTPS when accessing this app from another device. Open the HTTPS development URL."
        : "Microphone API (navigator.mediaDevices.getUserMedia) is not supported or restricted in this browser context.";

      this.onError(errorMsg);
      this.onConnectionStateChange("MIC_ERROR");
      return;
    }

    // 2. Acquire local microphone stream
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      this.onLocalStreamReady(this.localStream);
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        this.onError("Microphone permission denied. Please grant microphone access in your browser settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        this.onError("No microphone device was found on this system.");
      } else {
        this.onError(`Microphone access error: ${err.message || err.name}`);
      }
      this.onConnectionStateChange("MIC_ERROR");
      return;
    }

    // 2. Connect to WebRTC Signaling WebSocket
    this.onConnectionStateChange("SIGNALING_CONNECTING");
    const wsUrl = `${WS_BASE_URL}/ws/signaling/${this.roomId}/${this.clientId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.onConnectionStateChange("SIGNALING_CONNECTED");
    };

    this.ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await this.handleSignalingMessage(msg);
      } catch (err) {
        console.error("[WebRTC] Error handling message:", err);
      }
    };

    this.ws.onerror = (err) => {
      console.error("[WebRTC] Signaling error:", err);
      this.onError("Signaling connection error");
    };

    this.ws.onclose = () => {
      if (this.isCallActive) {
        this.onConnectionStateChange("DISCONNECTED");
      }
    };
  }

  async handleSignalingMessage(msg) {
    switch (msg.type) {
      case "room_joined":
        if (msg.ice_servers && msg.ice_servers.length > 0) {
          this.iceServers = msg.ice_servers;
        }
        // If other peers already exist, wait for them to initiate or initiate
        if (msg.peers && msg.peers.length > 0) {
          for (const peerId of msg.peers) {
            await this.initiateCallToPeer(peerId);
          }
        }
        this.onConnectionStateChange("WAITING_FOR_PEER");
        break;

      case "peer_joined":
        this.onPeerJoined(msg.peer_id);
        // The peer that joined will initiate the offer, or we initiate
        break;

      case "offer":
        await this.handleOffer(msg.sender, msg.sdp);
        break;

      case "answer":
        await this.handleAnswer(msg.sender, msg.sdp);
        break;

      case "ice_candidate":
        await this.handleRemoteIceCandidate(msg.sender, msg.candidate);
        break;

      case "peer_left":
        this.handlePeerLeft(msg.peer_id);
        break;

      default:
        break;
    }
  }

  createPeerConnection(peerId) {
    if (this.peerConnections[peerId]) {
      return this.peerConnections[peerId];
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    // Add local audio tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: "ice_candidate",
          target: peerId,
          candidate: event.candidate
        }));
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} connection state: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        this.onConnectionStateChange("CONNECTED");
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.onConnectionStateChange("PEER_DISCONNECTED");
      }
    };

    // Receiving remote audio stream
    pc.ontrack = (event) => {
      console.log("[WebRTC] Received remote track:", event.track.kind);
      const remoteStream = event.streams[0];
      if (remoteStream) {
        // Play remote audio through browser speaker
        this.playAudioStream(remoteStream);
        // Pass stream to detection callback
        this.onRemoteStream(remoteStream, peerId);
      }
    };

    this.peerConnections[peerId] = pc;
    return pc;
  }

  playAudioStream(stream) {
    let audioEl = document.getElementById("remote-audio-player");
    if (!audioEl) {
      audioEl = document.createElement("audio");
      audioEl.id = "remote-audio-player";
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
    audioEl.play().catch((e) => console.warn("Autoplay audio blocked:", e));
  }

  async initiateCallToPeer(peerId) {
    this.onConnectionStateChange("CALLING_PEER");
    const pc = this.createPeerConnection(peerId);

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });
    await pc.setLocalDescription(offer);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "offer",
        target: peerId,
        sdp: offer
      }));
    }
  }

  async handleOffer(senderId, sdp) {
    this.onConnectionStateChange("CONNECTING_PEER");
    const pc = this.createPeerConnection(senderId);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "answer",
        target: senderId,
        sdp: answer
      }));
    }
  }

  async handleAnswer(senderId, sdp) {
    const pc = this.peerConnections[senderId];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  async handleRemoteIceCandidate(senderId, candidate) {
    const pc = this.peerConnections[senderId];
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("[WebRTC] Error adding ICE candidate:", err);
      }
    }
  }

  handlePeerLeft(peerId) {
    if (this.peerConnections[peerId]) {
      this.peerConnections[peerId].close();
      delete this.peerConnections[peerId];
    }
    this.onPeerLeft(peerId);
    if (Object.keys(this.peerConnections).length === 0) {
      this.onConnectionStateChange("WAITING_FOR_PEER");
    }
  }

  toggleMute() {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isMuted = !audioTrack.enabled;
      return this.isMuted;
    }
    return false;
  }

  stop() {
    this.isCallActive = false;
    // Close signaling
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "leave" }));
      }
      this.ws.close();
      this.ws = null;
    }

    // Close peer connections
    for (const pid in this.peerConnections) {
      this.peerConnections[pid].close();
    }
    this.peerConnections = {};

    // Stop local microphone tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Stop remote audio element
    const audioEl = document.getElementById("remote-audio-player");
    if (audioEl) {
      audioEl.srcObject = null;
    }

    this.onConnectionStateChange("ENDED");
  }
}
