import time
import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from ..config import settings
from ..detection.audio_processor import load_audio_from_bytes, slice_into_chunks
from ..detection.deepfense_service import deepfense_service

router = APIRouter(prefix="/api/detect", tags=["File Detection"])

@router.post("/file")
async def analyze_file(
    file: UploadFile = File(...),
    threshold: float = Form(default=settings.DEFAULT_SPOOF_THRESHOLD),
    min_spoof_chunks: int = Form(default=1)
):
    """
    Analyzes an uploaded audio file for voice cloning / spoofing.
    Slices audio into 4-second chunks, resamples to 16 kHz, runs in-process DeepFense inference.
    Does not write permanent files to disk.
    """
    t_start = time.time()
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
        
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read upload: {str(e)}")

    # 1. Decode and normalize audio to 16 kHz mono in a worker thread
    try:
        audio_samples, duration_sec = await asyncio.to_thread(
            load_audio_from_bytes, content, settings.TARGET_SR
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Unsupported or corrupted audio format: {str(e)}")

    if duration_sec < 0.1:
        raise HTTPException(status_code=400, detail="Audio duration is too short (< 0.1s)")

    # 2. Slice into sequential 4-second (64,000 sample) chunks
    raw_chunks = slice_into_chunks(audio_samples, settings.CHUNK_SAMPLES)
    if not raw_chunks:
        raise HTTPException(status_code=400, detail="Failed to slice audio into chunks")

    chunk_arrays = [item[3] for item in raw_chunks]

    # 3. Run DeepFense inference on all chunks in worker thread (non-blocking)
    try:
        chunk_results = await asyncio.to_thread(
            deepfense_service.analyze_batch, chunk_arrays, threshold
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

    # 4. Assemble chunk metadata and overall file evaluation
    chunks_data = []
    spoof_count = 0
    scores_list = []

    for (c_idx, start_t, end_t, _), res in zip(raw_chunks, chunk_results):
        score = res["score"]
        label = res["label"]
        scores_list.append(score)
        if label == "spoof":
            spoof_count += 1
            
        chunks_data.append({
            "chunk_index": c_idx,
            "start_time": start_t,
            "end_time": end_t,
            "score": score,
            "label": label,
            "inference_time_ms": res["inference_time_ms"]
        })

    # Overall score: mean across all 4s chunks
    overall_score = round(sum(scores_list) / len(scores_list), 4) if scores_list else 0.0
    
    # Authoritative application policy: if spoof chunks >= min_spoof_chunks, flag file as spoof
    overall_label = "spoof" if spoof_count >= min_spoof_chunks else "bonafide"

    total_time_ms = round((time.time() - t_start) * 1000, 1)

    return JSONResponse(content={
        "filename": file.filename,
        "duration_seconds": round(duration_sec, 2),
        "num_chunks": len(chunks_data),
        "threshold": threshold,
        "overall_label": overall_label,
        "overall_score": overall_score,
        "spoof_chunk_count": spoof_count,
        "bonafide_chunk_count": len(chunks_data) - spoof_count,
        "min_spoof_chunks_policy": min_spoof_chunks,
        "chunks": chunks_data,
        "total_processing_time_ms": total_time_ms
    })
