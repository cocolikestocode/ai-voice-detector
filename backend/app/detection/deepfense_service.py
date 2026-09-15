import os
import sys
import time
import logging
import threading
import numpy as np
import torch
from omegaconf import OmegaConf

from ..config import settings, DEEPFENSE_DIR

# Ensure deepfense framework is importable
if str(DEEPFENSE_DIR) not in sys.path:
    sys.path.insert(0, str(DEEPFENSE_DIR))

from deepfense.utils.registry import build_detector
from deepfense.models import *

logger = logging.getLogger("deepfense.service")

class DeepFenseInferenceService:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(DeepFenseInferenceService, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def initialize(self):
        if getattr(self, "_initialized", False):
            return
            
        with self._lock:
            if getattr(self, "_initialized", False):
                return
                
            logger.info("Initializing DeepFenseInferenceService...")
            t0 = time.time()
            
            # 1. Resolve compute device
            if settings.DEVICE == "auto":
                self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            else:
                self.device = torch.device(settings.DEVICE)
            logger.info(f"Using compute device: {self.device}")
            
            # 2. Load and adapt configuration
            if not os.path.exists(settings.CONFIG_PATH):
                raise FileNotFoundError(f"DeepFense config not found at: {settings.CONFIG_PATH}")
            cfg = OmegaConf.load(settings.CONFIG_PATH)
            
            # Ensure WavLM checkpoint path points to existing local file
            if not os.path.exists(settings.WAVLM_PATH):
                raise FileNotFoundError(f"Pretrained WavLM not found at: {settings.WAVLM_PATH}")
            cfg.model.frontend.args.ckpt_path = settings.WAVLM_PATH
            
            # 3. Build detector
            logger.info(f"Building detector: {cfg.model.type}...")
            model_cfg = OmegaConf.to_container(cfg.model, resolve=True)
            self.model = build_detector(cfg.model.type, model_cfg)
            self.model.to(self.device)
            
            # 4. Load trained checkpoint weights
            if not os.path.exists(settings.CKPT_PATH):
                raise FileNotFoundError(f"Trained checkpoint not found at: {settings.CKPT_PATH}")
            logger.info(f"Loading checkpoint weights from: {settings.CKPT_PATH}...")
            state = torch.load(settings.CKPT_PATH, map_location=self.device, weights_only=False)
            if "model_state" in state:
                self.model.load_state_dict(state["model_state"])
            else:
                self.model.load_state_dict(state)
                
            self.model.eval()
            self._infer_lock = threading.Lock()
            self._initialized = True
            logger.info(f"DeepFenseInferenceService ready in {time.time() - t0:.2f}s.")

    def analyze_chunk(self, chunk_samples: np.ndarray, threshold: float = settings.DEFAULT_SPOOF_THRESHOLD) -> dict:
        """
        Synchronous single 4-second chunk inference (64,000 samples at 16 kHz).
        Must be called from a worker thread so asyncio event loop is not blocked.
        """
        if not self._initialized:
            self.initialize()
            
        assert chunk_samples.ndim == 1, "Audio chunk must be 1D array"
        assert len(chunk_samples) == settings.CHUNK_SAMPLES, f"Chunk must have {settings.CHUNK_SAMPLES} samples"
        
        x = torch.from_numpy(chunk_samples).unsqueeze(0).to(self.device)  # shape: (1, 64000)
        mask = torch.ones_like(x, dtype=torch.float32)
        
        t0 = time.time()
        with self._infer_lock:
            with torch.no_grad():
                outputs = self.model(x, mask=mask)
        latency = time.time() - t0
        
        scores = outputs["scores"]
        if scores.ndim == 1 or (scores.ndim == 2 and scores.shape[1] == 1):
            score_val = float(scores.cpu().item())
        else:
            # 2-class logits: score_class1 is bonafide
            score_val = float(scores[:, 1].cpu().item())
            
        label = "bonafide" if score_val >= threshold else "spoof"
        
        return {
            "score": round(score_val, 4),
            "label": label,
            "threshold": threshold,
            "inference_time_ms": round(latency * 1000, 1)
        }

    def analyze_batch(self, batch_chunks: list[np.ndarray], threshold: float = settings.DEFAULT_SPOOF_THRESHOLD) -> list[dict]:
        """
        Synchronous batch inference for multiple 4-second chunks (e.g. from an uploaded file).
        Runs chunks through model with minimal overhead.
        """
        if not self._initialized:
            self.initialize()
            
        if not batch_chunks:
            return []
            
        # Stack chunks: shape (N, 64000)
        stacked = np.stack(batch_chunks, axis=0).astype(np.float32)
        x = torch.from_numpy(stacked).to(self.device)
        mask = torch.ones_like(x, dtype=torch.float32)
        
        t0 = time.time()
        with self._infer_lock:
            with torch.no_grad():
                outputs = self.model(x, mask=mask)
        total_time = time.time() - t0
        per_chunk_time = (total_time / len(batch_chunks)) * 1000
        
        scores = outputs["scores"].detach().cpu().numpy()
        results = []
        for i in range(len(batch_chunks)):
            if scores.ndim == 1:
                score_val = float(scores[i])
            elif scores.ndim == 2 and scores.shape[1] == 1:
                score_val = float(scores[i, 0])
            else:
                score_val = float(scores[i, 1])
                
            label = "bonafide" if score_val >= threshold else "spoof"
            results.append({
                "score": round(score_val, 4),
                "label": label,
                "threshold": threshold,
                "inference_time_ms": round(per_chunk_time, 1)
            })
            
        return results

# Singleton accessor
deepfense_service = DeepFenseInferenceService()
