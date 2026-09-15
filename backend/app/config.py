import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Root directory of the repository
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEEPFENSE_DIR = BASE_DIR / "deepfense-framework"

class Settings(BaseSettings):
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["*"]
    
    # DeepFense model paths
    CONFIG_PATH: str = str(DEEPFENSE_DIR / "models" / "ASV5_WavLM_AASIST_NoAug_Seed42" / "config.yaml")
    CKPT_PATH: str = str(DEEPFENSE_DIR / "models" / "ASV5_WavLM_AASIST_NoAug_Seed42" / "best_model.pth")
    WAVLM_PATH: str = str(DEEPFENSE_DIR / "pretrained_models" / "WavLM-Large.pt")
    
    # Device: "auto", "cpu", or "cuda"
    DEVICE: str = "auto"
    
    # Model threshold (authoritative DeepFense threshold)
    DEFAULT_SPOOF_THRESHOLD: float = 1.0
    
    # Audio constants matching DeepFense model
    TARGET_SR: int = 16000
    CHUNK_DURATION_SEC: float = 4.0
    CHUNK_SAMPLES: int = 64000  # 16000 * 4
    
    # Application-level risk policy defaults (separate from model threshold)
    POLICY_SPOOF_CHUNKS_FOR_SUSPECTED: int = 1
    POLICY_CONSECUTIVE_SPOOF_FOR_ALERT: int = 2
    
    # WebRTC STUN/TURN server configuration
    ICE_SERVERS: list[dict] = [
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun1.l.google.com:19302"}
    ]
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
