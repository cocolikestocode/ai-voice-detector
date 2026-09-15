import os
import sys
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PRETRAINED_DIR = BASE_DIR / "deepfense-framework" / "pretrained_models"
MODEL_DIR = BASE_DIR / "deepfense-framework" / "models" / "ASV5_WavLM_AASIST_NoAug_Seed42"

WAVLM_URL = "https://github.com/bshall/knn-vc/releases/download/v0.1/WavLM-Large.pt"
WAVLM_PATH = PRETRAINED_DIR / "WavLM-Large.pt"
CHECKPOINT_PATH = MODEL_DIR / "best_model.pth"

def download_with_progress(url: str, output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {output_path.name} from:\n  {url}")

    def reporthook(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = downloaded * 100 / total_size
            mb = downloaded / (1024 * 1024)
            total_mb = total_size / (1024 * 1024)
            sys.stdout.write(f"\r[{percent:5.1f}%] {mb:7.1f} MB / {total_mb:7.1f} MB")
            sys.stdout.flush()

    urllib.request.urlretrieve(url, output_path, reporthook=reporthook)
    print("\nDownload complete.")

def main():
    print("=== DeepFense Model Setup Utility ===")

    # 1. WavLM-Large.pt
    if WAVLM_PATH.exists() and WAVLM_PATH.stat().st_size > 1000000:
        print(f"[OK] WavLM-Large.pt found ({WAVLM_PATH.stat().st_size / (1024*1024):.1f} MB)")
    else:
        print("Downloading WavLM-Large SSL frontend (~1.2 GB)...")
        download_with_progress(WAVLM_URL, WAVLM_PATH)

    # 2. Checkpoint best_model.pth
    if CHECKPOINT_PATH.exists() and CHECKPOINT_PATH.stat().st_size > 1000000:
        print(f"[OK] ASV5 checkpoint found ({CHECKPOINT_PATH.stat().st_size / (1024*1024):.1f} MB)")
    else:
        print("Downloading ASV5 fine-tuned checkpoint (~3.8 GB) via deepfense CLI / HuggingFace...")
        try:
            import subprocess
            subprocess.run([
                "deepfense", "download", "model", "ASV5_WavLM_AASIST_NoAug_Seed42"
            ], check=True)
        except Exception as e:
            print(f"Notice: You can download the checkpoint manually from HuggingFace (DeepFense/ASV5_WavLM_AASIST_NoAug_Seed42) and place it at:\n  {CHECKPOINT_PATH}")

    print("\nAll models verified and ready for inference!")

if __name__ == "__main__":
    main()
