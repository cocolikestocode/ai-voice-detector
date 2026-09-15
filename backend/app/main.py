import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .detection.deepfense_service import deepfense_service
from .api.file_detection import router as file_router
from .api.signaling import router as signaling_router
from .api.live_detection import router as detection_router

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("deepfense.app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: preload DeepFense model once into memory
    logger.info("Starting up Voice Clone Detection Backend...")
    try:
        deepfense_service.initialize()
        logger.info("DeepFense model preloaded successfully.")
    except Exception as e:
        logger.error(f"Failed to preload DeepFense model: {e}")
        raise e
    yield
    # Shutdown
    logger.info("Shutting down Voice Clone Detection Backend...")

app = FastAPI(
    title="DeepFense AI Voice Clone Detection API",
    description="Backend API for File Analysis and Real-Time Browser-to-Browser Voice Clone Detection (SIH 2026 / SIH26104)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API and WebSocket routers
app.include_router(file_router)
app.include_router(signaling_router)
app.include_router(detection_router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "service": "DeepFense Voice Clone Detection",
        "model": {
            "frontend": "WavLM-Large",
            "backend": "AASIST",
            "device": str(deepfense_service.device) if deepfense_service._initialized else "uninitialized",
            "sampling_rate": settings.TARGET_SR,
            "chunk_duration_sec": settings.CHUNK_DURATION_SEC,
            "chunk_samples": settings.CHUNK_SAMPLES,
            "default_threshold": settings.DEFAULT_SPOOF_THRESHOLD
        }
    }

@app.get("/api/config")
async def get_config():
    return {
        "default_threshold": settings.DEFAULT_SPOOF_THRESHOLD,
        "chunk_duration_sec": settings.CHUNK_DURATION_SEC,
        "sampling_rate": settings.TARGET_SR,
        "ice_servers": settings.ICE_SERVERS,
        "policy": {
            "suspected_spoof_chunks": settings.POLICY_SPOOF_CHUNKS_FOR_SUSPECTED,
            "alert_consecutive_spoof_chunks": settings.POLICY_CONSECUTIVE_SPOOF_FOR_ALERT
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
