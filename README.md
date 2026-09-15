# DeepFense AI Voice Clone Detection System

> **SIH 2026 Problem Statement SIH26104 — Voice Cloning Detection**  
> High-performance voice authenticity evaluation engine powered by `WavLM-Large` frontend and `AASIST` backend, supporting both offline **Audio File Analysis** and **Real-Time Browser-to-Browser WebRTC Voice Call Detection**.

---

## System Architecture

```
AI-Voice-Detection/
├── deepfense-framework/            # Pretrained base model and fine-tuned checkpoints
│   ├── pretrained_models/
│   │   └── WavLM-Large.pt          # WavLM-Large SSL feature extractor (1.26 GB)
│   └── models/ASV5_WavLM_AASIST_NoAug_Seed42/
│       ├── best_model.pth          # Fine-tuned AASIST detector checkpoint (3.79 GB)
│       └── config.yaml             # Model & loss configuration
│
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI application, CORS, lifespan startup
│   │   ├── config.py               # Environment & dynamic configuration
│   │   ├── api/
│   │   │   ├── file_detection.py   # Mode 1: POST /api/detect/file (chunking & scoring)
│   │   │   ├── signaling.py        # Mode 2: WebRTC Signaling WS (/ws/signaling/...)
│   │   │   └── live_detection.py   # Mode 2: Transient Audio Detection WS (/ws/detect/...)
│   │   └── detection/
│   │       ├── deepfense_service.py# In-process singleton PyTorch inference service
│   │       ├── audio_processor.py  # 16 kHz normalization, 4s repeat-pad chunking
│   │       └── risk_engine.py      # Session risk policy & voice integrity tracker
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Mode switcher and backend status HUD
│   │   │   ├── FileAnalysis.jsx    # Mode 1 UI (drag & drop, score timeline)
│   │   │   ├── LiveCall.jsx        # Mode 2 UI (WebRTC call + live detection HUD)
│   │   │   └── AudioVisualizer.jsx # Real-time HTML5 audio spectrum canvas
│   │   ├── services/
│   │   │   ├── webrtc.js           # Browser RTCPeerConnection & signaling client
│   │   │   └── audioCapture.js     # Transient remote audio downsampling client
│   │   ├── config.js               # Dynamic API / WebSocket host configuration
│   │   └── index.css               # Cybersecurity dark-mode design system
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

## Key Technical Specifications

| Parameter | Specification | Details |
| :--- | :--- | :--- |
| **Frontend Model** | `WavLM-Large` | Self-supervised speech representations (`pretrained_models/WavLM-Large.pt`) |
| **Backend Model** | `AASIST` | Heterogeneous spectral-temporal graph attention network |
| **Trained Checkpoint** | `best_model.pth` | `ASV5_WavLM_AASIST_NoAug_Seed42` fine-tuned detector |
| **Audio Format** | 16 kHz Mono | Evaluated in sequential 4-second (64,000 samples) windows |
| **Score Semantics** | Logit score of Class 1 | Higher = Authentic / Bonafide; Lower / Negative = Synthetic / Spoof |
| **Authoritative Threshold** | `1.0` (Configurable) | Score < 1.0 is flagged as `spoof`; Score ≥ 1.0 is `bonafide` |
| **Inference Mode** | In-Process PyTorch | Preloaded once at startup; no CLI or disk overhead |
| **Inference Speed** | ~0.93s on CPU | Runs via worker threads to ensure WebRTC signaling never blocks |
| **Privacy Policy** | Zero Audio Storage | Audio is analyzed transiently in-memory and discarded immediately |

---

## Quick Start Guide: How to Run the Project

Whether you are running the project on your local machine or deploying it on another developer's system, follow these steps.

---

### Step 0: Clone the Repository & Setup Models (Required for Both Methods)

```bash
# 1. Clone the repository
git clone https://github.com/cocolikestocode/ai-voice-detector.git
cd ai-voice-detector

# 2. Download or verify the model weights
# Note: GitHub enforces a 100 MB file limit, so large model files (1.26 GB and 3.79 GB) 
# are not stored directly in git. Run our setup utility to download them:
python download_models.py
```

The model files must be located at:
- `deepfense-framework/pretrained_models/WavLM-Large.pt` (1.26 GB)
- `deepfense-framework/models/ASV5_WavLM_AASIST_NoAug_Seed42/best_model.pth` (3.79 GB)

---

## Method 1: Local Development (Recommended for Fast Iteration & SIH Demo)

### 1. Prerequisites
- **Python**: 3.10, 3.11, or 3.12 installed
- **Node.js**: v18 or newer installed (includes `npm`)
- **Operating System**: Windows, Linux, or macOS

### 2. Backend Setup & Startup
Open **Terminal 1** at the project root:

```bash
# Install backend Python dependencies
pip install -r backend/requirements.txt

# Install deepfense framework in editable mode
pip install -e deepfense-framework --no-deps

# Start FastAPI backend server with hot-reload
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

> **Startup Verification**: You will see DeepFense preload the models in ~8 seconds:
> ```
> [INFO] [deepfense.service] Building detector: StandardDetector...
> [INFO] [deepfense.service] Loading checkpoint weights from: .../best_model.pth
> [INFO] [deepfense.service] DeepFenseInferenceService ready in ~8s.
> INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
> ```
> Backend health can be verified at: `http://localhost:8000/api/health`

### 3. Frontend Setup & Startup (HTTPS for Mobile/Android Support)
Open **Terminal 2** at the project root:

```bash
cd frontend

# Install frontend Node dependencies
npm install

# Start Vite dev server over HTTPS (listens on 0.0.0.0 for LAN access)
npm run dev
```

Vite will start and output your accessible URLs:
```
  ➜  Local:   https://localhost:5173/
  ➜  Network: https://10.255.214.64:5173/
```

- **Local Machine**: Open `https://localhost:5173/` in your browser.
- **Android Phone / LAN Device**: Open `https://<YOUR_LAN_IP>:5173/` in Android Chrome.

---

## Method 2: Docker Compose (All-in-One Containerized Setup)

Run the complete frontend, backend, reverse proxy, and PyTorch inference pipeline in isolated Docker containers with a single command.

### 1. Prerequisites
- **Docker** and **Docker Compose** installed (e.g. [Docker Desktop](https://www.docker.com/products/docker-desktop/))
- Ensure model weights are present in `deepfense-framework/` (Step 0)

### 2. Build & Launch Containers
From the project root:

```bash
# Build and start both containers in the background
docker compose up --build
```

Docker Compose spins up two coordinated services:
1. **`deepfense-backend`**:
   - Python 3.11 with PyTorch (CPU-optimized), Libsndfile, and FFmpeg.
   - Automatically preloads `WavLM-Large.pt` and `best_model.pth` via read-only volume mount.
   - Internal healthcheck monitors `http://localhost:8000/api/health`.
2. **`deepfense-frontend`**:
   - Multi-stage build compiling the React SPA into static assets.
   - Nginx reverse proxy serving static files on port `3000`, proxying `/api` REST requests and `/ws` WebSockets directly to the backend container.

### 3. Accessing the Application
- **Web App**: Open `http://localhost:3000` (or `http://<HOST_IP>:3000` from any device on your local network).
- **Backend Healthcheck**: `http://localhost:8000/api/health`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

### 4. Stopping the Application
```bash
# Stop and clean up containers
docker compose down
```

> **Why Host Volume Mounts?**  
> Notice in `docker-compose.yml` that `./deepfense-framework` is mounted into `/app/deepfense-framework:ro`. This prevents copying ~5 GB of model weights into Docker image layers, keeping Docker builds fast (<30s) and image sizes lightweight.

---

## Mobile & Android Microphone Setup (HTTPS Guide)

Modern mobile browsers (Android Chrome, iOS Safari) **strictly require HTTPS** to permit microphone access (`navigator.mediaDevices.getUserMedia`). Accessing over plain HTTP from a LAN IP results in `getUserMedia is undefined`.

The Vite dev server (`npm run dev`) runs on HTTPS automatically with generated SSL certificates.
*(Or simply start the server; `@vitejs/plugin-basic-ssl` will automatically provide a valid dev certificate as a fallback).*

### Start the Vite HTTPS Dev Server
```bash
# In Terminal 2 (from project root):
cd frontend
npm run dev
```

Vite will start and display your secure URLs:
```
  VITE ready in ~300 ms

  ➜  Local:   https://localhost:5173/
  ➜  Network: https://10.255.214.64:5173/
```

- **Local Machine**: Open `https://localhost:5173/`
- **Android Phone / LAN Device**: Open `https://10.255.214.64:5173/` (replace with your machine's LAN IP)

---

## 5. Trusting the Development Certificate on Android

When opening `https://<LAN_IP>:5173` on Android Chrome for the first time, Chrome displays a security notice because it is a local development certificate.

### Option A: Quick Proceed (Recommended for Fast Testing)
1. Open `https://10.255.214.64:5173` in Android Chrome.
2. On the *"Your connection is not private"* screen, tap **Advanced**.
3. Tap **"Proceed to 10.255.214.64 (unsafe)"**.
4. The application will load in a full **Secure Context (HTTPS)**.
5. When you launch a Live Call, Chrome will display the standard system prompt: **"Allow DeepFense to use your microphone?"** $\rightarrow$ Tap **Allow**.

### Option B: Install the Root CA Certificate on Android (Green Lock)
To make Android trust the connection without any warnings:
1. Transfer `frontend/certs/ca.crt` to your Android device (via Google Drive, USB, or email).
2. On Android, open **Settings** $\rightarrow$ **Security & Privacy** $\rightarrow$ **More security settings** $\rightarrow$ **Encryption & credentials**.
3. Tap **Install a certificate** $\rightarrow$ **CA certificate**.
4. Tap **Install anyway** and select `ca.crt`.
5. Open `https://10.255.214.64:5173` in Chrome. The connection is fully trusted with a secure green padlock.

### Option C: Chrome Dev Flag (Alternative)
In Android Chrome, navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`:
- Enable the flag.
- Add `http://10.255.214.64:5173` (or your LAN IP) into the text box.
- Tap **Relaunch**.

---

## 6. How WebSocket and API Proxying Works over HTTPS

When your Android phone loads `https://10.255.214.64:5173`:
1. The frontend automatically connects to **`wss://10.255.214.64:5173/ws/...`** for signaling and live audio detection.
2. The Vite dev server proxies:
   - `/api` requests $\rightarrow$ `http://127.0.0.1:8000/api`
   - `/ws` WebSocket connections $\rightarrow$ `ws://127.0.0.1:8000/ws`
3. This eliminates **Mixed Content errors** (no unencrypted `ws://` or `http://` calls from an encrypted page) and avoids needing complex SSL setup on the backend.

---

## 7. Testing Mode 1 — Audio File Analysis

1. In the navigation bar, click **"Analyze Audio File"**.
2. Click the dropzone or drag-and-drop any audio file (e.g. `deepfense-framework/tests/dummy_audio/test.wav`).
3. Adjust the **Spoof Score Threshold** slider if desired (default: `1.0`).
4. Set the **Min Spoof Chunks for File Spoof** policy (default: `1`).
5. Click **"Run DeepFense Verification"**.
6. Inspect the results:
   - **Overall Authenticity Banner**: `AUTHENTIC HUMAN VOICE` or `SYNTHETIC VOICE / SPOOF DETECTED`.
   - **Overall Score**: Mean score across all 4-second chunks.
   - **Metrics**: Total chunks, spoof segments count, and PyTorch inference latency.
   - **Chunk Breakdown**: Visual timeline displaying each 4-second window (0-4s, 4-8s, ...) with exact score and bonafide/spoof badge.

---

## 8. Testing Mode 2 — Real-Time Browser-to-Browser Call

1. In the navigation bar, switch to **"Secure Live Call"**.
2. **Client 1 (Laptop / Desktop Browser)**:
   - Open `https://localhost:5173`.
   - Enter or generate a Room ID (e.g. `sih-demo-room`).
   - Click **"Launch Secure Voice Call"**.
   - Grant microphone permissions when prompted.
   - The status will show `WAITING FOR PEER`. The local audio visualizer will react to your voice.
3. **Client 2 (Android Phone on LAN)**:
   - Open `https://10.255.214.64:5173` in Android Chrome.
   - Switch to **"Secure Live Call"**.
   - Enter the identical Room ID (`sih-demo-room`).
   - Click **"Launch Secure Voice Call"**.
   - Grant microphone permissions when prompted.
4. **Live Call & Detection in Action**:
   - Both devices establish a genuine peer-to-peer WebRTC voice connection.
   - You can speak into your Android phone and hear your voice live on the laptop (and vice versa).
   - The recipient's Web Audio pipeline taps the incoming remote voice stream, downsamples to 16 kHz, and streams transient 4-second blocks over the secure `wss://` detection WebSocket.
   - Every 4 seconds, a new analyzed chunk card appears on the live dashboard with:
     - Chunk index (`#1`, `#2`, ...)
     - Time window (`00:00 – 00:04`, `00:04 – 00:08`, ...)
     - DeepFense score and badge (`BONAFIDE` or `SPOOF`)
     - Inference latency in milliseconds.
   - **Voice Integrity Risk Engine**:
     - `NORMAL`: All recent chunks authentic.
     - `SYNTHETIC VOICE SUSPECTED`: Isolated chunk dropped below threshold.
     - `AI VOICE CLONE DETECTED`: Sustained spoof chunks detected (critical warning banner).
5. **Call Controls**:
   - Click **"Mute Mic"** to mute/unmute your audio track in real time.
   - Click **"End Voice Call"** to hang up. All transient audio buffers are immediately flushed and freed.

---

## Optional Future Hosted / GPU Server Architecture

To deploy this application on a cloud GPU instance (e.g. AWS EC2 G4/G5, GCP A100/T4, or RunPod):

1. **Environment Variable Configuration**:
   ```env
   DEVICE=cuda
   CORS_ORIGINS=["https://your-domain.com"]
   HOST=0.0.0.0
   PORT=8000
   ```
2. **TURN Server Setup**:
   - For users behind symmetric NATs / cellular networks, add TURN credentials in `backend/app/config.py` under `ICE_SERVERS`.
3. **GPU Acceleration**:
   - With CUDA enabled, the WavLM + AASIST inference latency drops from ~0.93s down to ~80–120ms per 4-second chunk, allowing support for 30+ concurrent live call detection sessions per GPU.
