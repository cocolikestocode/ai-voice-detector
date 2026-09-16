#!/usr/bin/env python3
"""
DeepFense Native CLI Inference Tool
==================================
Run DeepFense voice authenticity analysis directly from the terminal without 
launching the web interface or frontend.

Usage:
  python predict.py audio.wav
  python predict.py sample1.wav sample2.mp3 --threshold 1.0
  python predict.py path/to/audio_folder/ --device cpu
  python predict.py audio.wav --json
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path

# Add project root and deepfense-framework to sys.path
ROOT_DIR = Path(__file__).resolve().parent
DEEPFENSE_DIR = ROOT_DIR / "deepfense-framework"
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(DEEPFENSE_DIR) not in sys.path:
    sys.path.insert(0, str(DEEPFENSE_DIR))

from backend.app.config import settings
from backend.app.detection.deepfense_service import DeepFenseInferenceService
from backend.app.detection.audio_processor import load_audio_from_bytes, slice_into_chunks

# Terminal ANSI color helpers
GREEN = "\033[92m"
RED = "\033[91m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

def analyze_single_file(file_path: Path, service: DeepFenseInferenceService, threshold: float, min_spoof_chunks: int = 1):
    t_start = time.time()
    
    # 1. Preprocess & slice audio
    with open(file_path, "rb") as f:
        audio_bytes = f.read()
    waveform, duration_sec = load_audio_from_bytes(audio_bytes)
    chunk_tuples = slice_into_chunks(waveform)
    
    # 2. Run batch inference on all 4-second chunks
    chunk_samples_list = [c[3] for c in chunk_tuples]
    batch_results = service.analyze_batch(chunk_samples_list, threshold=threshold)
    
    chunk_results = []
    spoof_count = 0
    scores = []
    
    for (chunk_idx, start_t, end_t, _), res in zip(chunk_tuples, batch_results):
        chunk_score = res["score"]
        is_spoof = (res["label"] == "spoof")
        scores.append(chunk_score)
        
        if is_spoof:
            spoof_count += 1
            
        chunk_results.append({
            "chunk_index": chunk_idx + 1,
            "start_sec": start_t,
            "end_sec": end_t,
            "score": round(chunk_score, 4),
            "label": res["label"],
            "is_spoof": is_spoof,
            "latency_ms": res.get("inference_time_ms", 0.0)
        })
        
    overall_is_spoof = spoof_count >= min_spoof_chunks
    overall_label = "spoof" if overall_is_spoof else "bonafide"
    mean_score = float(sum(scores) / len(scores)) if scores else 0.0
    total_latency = time.time() - t_start
    
    return {
        "file": str(file_path),
        "duration_sec": round(duration_sec, 2),
        "total_chunks": len(chunk_tuples),
        "spoof_chunks": spoof_count,
        "mean_score": round(mean_score, 4),
        "threshold": threshold,
        "overall_label": overall_label,
        "is_spoof": overall_is_spoof,
        "total_latency_sec": round(total_latency, 3),
        "chunks": chunk_results
    }

def print_pretty_result(res: dict):
    print(f"\n{BOLD}{'=' * 65}{RESET}")
    print(f" {BOLD}File:{RESET} {CYAN}{res['file']}{RESET}")
    print(f" {BOLD}Duration:{RESET} {res['duration_sec']}s  |  {BOLD}Chunks:{RESET} {res['total_chunks']} (4s windows)")
    print(f"{'=' * 65}")
    
    print(f" {'#':<4} {'Window':<16} {'Score':<10} {'Verdict':<12} {'Latency':<8}")
    print(f" {'-'*4} {'-'*16} {'-'*10} {'-'*12} {'-'*8}")
    
    for c in res["chunks"]:
        window_str = f"{c['start_sec']:04.1f}s - {c['end_sec']:04.1f}s"
        if c["is_spoof"]:
            badge = f"{RED}{BOLD}SPOOF{RESET}"
            score_str = f"{RED}{c['score']:+.4f}{RESET}"
        else:
            badge = f"{GREEN}{BOLD}BONAFIDE{RESET}"
            score_str = f"{GREEN}{c['score']:+.4f}{RESET}"
            
        print(f" {c['chunk_index']:<4} {window_str:<16} {score_str:<19} {badge:<21} {c['latency_ms']}ms")
        
    print(f"{'-' * 65}")
    if res["is_spoof"]:
        status_banner = f"{RED}{BOLD}[!] SYNTHETIC VOICE / AI CLONE DETECTED{RESET}"
    else:
        status_banner = f"{GREEN}{BOLD}[OK] AUTHENTIC HUMAN VOICE (BONAFIDE){RESET}"
        
    print(f" Final Verdict: {status_banner}")
    print(f" Mean Score:    {res['mean_score']}  (Threshold: {res['threshold']})")
    print(f" Spoof Chunks:  {res['spoof_chunks']} / {res['total_chunks']}")
    print(f" Total Latency: {res['total_latency_sec']}s")
    print(f"{BOLD}{'=' * 65}{RESET}\n")

def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(
        description="DeepFense Native Audio Forensics CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python predict.py audio.wav
  python predict.py sample.wav --threshold 1.0 --device cpu
  python predict.py folder_with_audio/ --json
"""
    )
    parser.add_argument("inputs", nargs="+", help="Audio file path(s) or directory containing audio files")
    parser.add_argument("--threshold", type=float, default=settings.DEFAULT_SPOOF_THRESHOLD,
                        help=f"Spoof detection threshold (default: {settings.DEFAULT_SPOOF_THRESHOLD}). Score < threshold is spoof.")
    parser.add_argument("--min-spoof-chunks", type=int, default=1,
                        help="Minimum number of spoof chunks required to flag entire file (default: 1)")
    parser.add_argument("--device", type=str, default="auto", choices=["auto", "cpu", "cuda"],
                        help="Compute device to use (default: auto)")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")

    args = parser.parse_args()

    # Collect target audio files
    audio_extensions = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}
    target_files = []
    
    for input_arg in args.inputs:
        path = Path(input_arg)
        if path.is_file():
            target_files.append(path)
        elif path.is_dir():
            for f in path.rglob("*"):
                if f.suffix.lower() in audio_extensions:
                    target_files.append(f)
        else:
            print(f"{YELLOW}Warning: File or path not found: {input_arg}{RESET}", file=sys.stderr)

    if not target_files:
        print(f"{RED}Error: No valid audio files found to analyze.{RESET}", file=sys.stderr)
        sys.exit(1)

    if args.device != "auto":
        settings.DEVICE = args.device

    if not args.json:
        print(f"{CYAN}{BOLD}=== DeepFense Native Neural Inference ==={RESET}")
        print(f"Loading WavLM-Large + AASIST checkpoint on [{settings.DEVICE}]...")

    service = DeepFenseInferenceService()
    service.initialize()

    if not args.json:
        print(f"Model ready. Processing {len(target_files)} audio file(s)...\n")

    results = []
    for file_path in target_files:
        try:
            res = analyze_single_file(file_path, service, threshold=args.threshold, min_spoof_chunks=args.min_spoof_chunks)
            results.append(res)
            if not args.json:
                print_pretty_result(res)
        except Exception as e:
            if not args.json:
                print(f"{RED}Error analyzing {file_path}: {e}{RESET}", file=sys.stderr)
            else:
                results.append({"file": str(file_path), "error": str(e)})

    if args.json:
        print(json.dumps(results if len(results) > 1 else results[0], indent=2))

if __name__ == "__main__":
    main()
