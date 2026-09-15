import io
import math
import numpy as np
import soundfile as sf
import librosa
from ..config import settings

def load_audio_from_bytes(audio_bytes: bytes, target_sr: int = settings.TARGET_SR) -> tuple[np.ndarray, float]:
    """
    Decodes audio bytes into a 1D float32 numpy array at target_sr (16000 Hz) mono.
    Returns (audio_samples, duration_seconds).
    """
    with io.BytesIO(audio_bytes) as bio:
        # Read using soundfile first, fallback to librosa if needed
        try:
            x, sr = sf.read(bio, always_2d=False, dtype="float32")
        except Exception:
            bio.seek(0)
            x, sr = librosa.load(bio, sr=None, mono=False)
            
    # Convert multi-channel to mono
    if x.ndim > 1:
        x = np.mean(x, axis=1 if x.shape[0] > x.shape[1] else 0)
        
    x = np.asarray(x, dtype=np.float32)
    
    # Resample to target_sr if required
    if sr != target_sr:
        x = librosa.resample(x, orig_sr=sr, target_sr=target_sr)
        
    duration = len(x) / target_sr
    return x, duration

def pad_chunk_repeat(chunk: np.ndarray, target_len: int = settings.CHUNK_SAMPLES) -> np.ndarray:
    """
    Pads or truncates audio to target_len (64,000 samples) using repeat-tiling,
    identically matching DeepFense's training and evaluation transform.
    """
    n = chunk.shape[0]
    if n == 0:
        return np.zeros(target_len, dtype=np.float32)
    if n >= target_len:
        return chunk[:target_len]
    reps = int(math.ceil(target_len / n))
    return np.tile(chunk, reps)[:target_len].astype(np.float32)

def slice_into_chunks(audio: np.ndarray, chunk_samples: int = settings.CHUNK_SAMPLES) -> list[tuple[int, float, float, np.ndarray]]:
    """
    Slices a continuous 16 kHz audio array into sequential 4-second (64,000 sample) chunks.
    Returns list of tuples: (chunk_index, start_time_sec, end_time_sec, padded_chunk_samples).
    """
    total_samples = len(audio)
    if total_samples == 0:
        return []
    
    chunks = []
    chunk_idx = 0
    
    for start_sample in range(0, total_samples, chunk_samples):
        end_sample = min(start_sample + chunk_samples, total_samples)
        raw_chunk = audio[start_sample:end_sample]
        
        # Apply repeat-padding if the chunk is shorter than chunk_samples
        padded_chunk = pad_chunk_repeat(raw_chunk, chunk_samples)
        
        start_time = start_sample / settings.TARGET_SR
        end_time = end_sample / settings.TARGET_SR
        
        chunks.append((chunk_idx, round(start_time, 2), round(end_time, 2), padded_chunk))
        chunk_idx += 1
        
    return chunks
