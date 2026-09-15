import json
import time
import asyncio
import logging
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..config import settings
from ..detection.deepfense_service import deepfense_service
from ..detection.risk_engine import CallSessionRiskTracker, RiskPolicy
from ..detection.audio_processor import pad_chunk_repeat

logger = logging.getLogger("live.detection")

router = APIRouter(prefix="/ws/detect", tags=["Live Detection"])

# Active call session risk trackers keyed by f"{room_id}:{client_id}"
active_sessions: dict[str, CallSessionRiskTracker] = {}

@router.websocket("/{room_id}/{client_id}")
async def live_detection_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    await websocket.accept()
    session_key = f"{room_id}:{client_id}"
    tracker = CallSessionRiskTracker(session_id=session_key)
    active_sessions[session_key] = tracker

    # Bounded queue (max 3 items) for backpressure to ensure zero unbounded memory growth
    chunk_queue: asyncio.Queue[tuple[int, float, float, np.ndarray, float]] = asyncio.Queue(maxsize=3)
    
    threshold = settings.DEFAULT_SPOOF_THRESHOLD
    chunk_idx = 0
    stream_start_time = time.time()
    
    # In-memory transient buffer for 16 kHz mono PCM float32 samples
    pcm_buffer: list[float] = []

    # Send initial session readiness
    await websocket.send_text(json.dumps({
        "type": "detection_ready",
        "room_id": room_id,
        "client_id": client_id,
        "threshold": threshold,
        "policy": {
            "suspected_spoof_chunks": tracker.policy.suspected_spoof_chunks,
            "alert_consecutive_spoof_chunks": tracker.policy.alert_consecutive_spoof_chunks
        }
    }))

    # Background worker for in-process DeepFense inference (non-blocking)
    async def inference_worker():
        nonlocal threshold
        while True:
            try:
                item = await chunk_queue.get()
                c_idx, t_start, t_end, samples_np, thr = item
                
                # Run actual DeepFense inference in thread pool
                result = await asyncio.to_thread(
                    deepfense_service.analyze_chunk, samples_np, thr
                )
                
                # Update application-level risk state
                eval_data = tracker.add_chunk(
                    chunk_index=c_idx,
                    start_time=t_start,
                    end_time=t_end,
                    score=result["score"],
                    label=result["label"],
                    latency_ms=result["inference_time_ms"]
                )
                
                # Send live detection event back to dashboard
                msg = {
                    "type": "chunk_result",
                    "room_id": room_id,
                    "client_id": client_id,
                    "chunk": eval_data["chunk"],
                    "session_summary": eval_data["session_summary"],
                    "risk_state": eval_data["risk_state"]
                }
                await websocket.send_text(json.dumps(msg))
                chunk_queue.task_done()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in live inference worker: {e}")
                chunk_queue.task_done()

    worker_task = asyncio.create_task(inference_worker())

    try:
        while True:
            message = await websocket.receive()
            
            # Handle text control messages (e.g. updating threshold or policy)
            if "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                    cmd = payload.get("type")
                    if cmd == "set_config":
                        if "threshold" in payload:
                            threshold = float(payload["threshold"])
                        if "suspected_chunks" in payload or "alert_consecutive" in payload:
                            tracker.update_policy(
                                suspected_chunks=payload.get("suspected_chunks", tracker.policy.suspected_spoof_chunks),
                                alert_consecutive=payload.get("alert_consecutive", tracker.policy.alert_consecutive_spoof_chunks)
                            )
                        await websocket.send_text(json.dumps({
                            "type": "config_updated",
                            "threshold": threshold,
                            "policy": {
                                "suspected_spoof_chunks": tracker.policy.suspected_spoof_chunks,
                                "alert_consecutive_spoof_chunks": tracker.policy.alert_consecutive_spoof_chunks
                            }
                        }))
                except Exception as e:
                    logger.warning(f"Error parsing control message: {e}")
                    
            # Handle binary PCM audio data from remote WebRTC stream
            elif "bytes" in message and message["bytes"]:
                raw_bytes = message["bytes"]
                # Incoming audio is 16 kHz Float32 or Int16 PCM
                # We expect Float32 (little endian)
                try:
                    incoming_samples = np.frombuffer(raw_bytes, dtype=np.float32)
                except Exception:
                    continue
                    
                if len(incoming_samples) == 0:
                    continue
                    
                pcm_buffer.extend(incoming_samples.tolist())
                
                # Whenever 64,000 samples (4 seconds at 16 kHz) accumulate
                while len(pcm_buffer) >= settings.CHUNK_SAMPLES:
                    chunk_data = np.array(pcm_buffer[:settings.CHUNK_SAMPLES], dtype=np.float32)
                    pcm_buffer = pcm_buffer[settings.CHUNK_SAMPLES:]
                    
                    t_start = round(chunk_idx * settings.CHUNK_DURATION_SEC, 2)
                    t_end = round((chunk_idx + 1) * settings.CHUNK_DURATION_SEC, 2)
                    
                    item = (chunk_idx, t_start, t_end, chunk_data, threshold)
                    chunk_idx += 1
                    
                    # If queue is full (slow CPU inference), drop oldest item to maintain real-time responsiveness
                    if chunk_queue.full():
                        try:
                            _ = chunk_queue.get_nowait()
                            chunk_queue.task_done()
                            logger.warning(f"[LiveDetection] Dropped stale chunk due to queue backpressure")
                        except asyncio.QueueEmpty:
                            pass
                            
                    await chunk_queue.put(item)

    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception as e:
        logger.error(f"Live detection connection error: {e}")
    finally:
        worker_task.cancel()
        # Ensure complete privacy: drop all transient audio
        pcm_buffer.clear()
        active_sessions.pop(session_key, None)
        logger.info(f"[LiveDetection] Session {session_key} ended and all transient buffers cleared.")
