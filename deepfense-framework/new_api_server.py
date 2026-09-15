from typing import List, Annotated
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import os, shutil, uuid, subprocess, csv, glob
import pandas as pd
import numpy as np
import soundfile as sf
import yaml

app = FastAPI()

#some version related fix to make this work
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(title=app.title, version=app.version, routes=app.routes)

    for component in schema.get("components", {}).get("schemas", {}).values():
        for prop in component.get("properties", {}).values():
            if prop.get("contentMediaType") == "application/octet-stream":
                del prop["contentMediaType"]
                prop["format"] = "binary"
            items = prop.get("items", {})
            if items.get("contentMediaType") == "application/octet-stream":
                del items["contentMediaType"]
                items["format"] = "binary"

    app.openapi_schema = schema
    return app.openapi_schema

app.openapi = custom_openapi

BASE_DIR = os.getcwd()
print(BASE_DIR)
TEMP_DIR = os.path.join(BASE_DIR, "temp_audio")
RESULTS_DIR = os.path.join(BASE_DIR, "results_for_api")
CONFIG_PATH = os.path.join(BASE_DIR, "models/ASV5_WavLM_AASIST_NoAug_Seed42/config.yaml")
CKPT_PATH = os.path.join(BASE_DIR, "models/ASV5_WavLM_AASIST_NoAug_Seed42/best_model.pth")
PREDICTIONS_DIR = os.path.join(BASE_DIR, "models/ASV5_WavLM_AASIST_NoAug_Seed42/results/predictions")
CSV_OUTPUT = os.path.join(RESULTS_DIR, "api_results.csv")

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# Initialize central results CSV
if not os.path.exists(CSV_OUTPUT):
    with open(CSV_OUTPUT, mode="w", newline="") as f:
        csv.writer(f).writerow(["ID", "Path", "Score", "Label"])

def update_config_params(config_dict, new_batch, new_workers):
    """Recursively search for and dynamically update batch_size and num_workers."""
    for key, value in config_dict.items():
        if key == 'batch_size':
            config_dict[key] = new_batch
        elif key == 'num_workers':
            config_dict[key] = new_workers
        elif isinstance(value, dict):
            update_config_params(value, new_batch, new_workers)

@app.post("/predict")
async def predict_audio(files: Annotated[list[UploadFile], File(description="Upload multiple audio files")]):
    parquet_records = []
    file_chunk_mapping = {}  # Keeps track of which original file owns which 4-second chunk
    
    # 1. Process all uploaded files and split them into 4-second chunks
    for file in files:
        original_id = str(uuid.uuid4())[:8]
        ext = os.path.splitext(file.filename)[1] or ".wav"
        original_path = os.path.join(TEMP_DIR, f"{original_id}{ext}")
        
        with open(original_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        try:
            data, sr = sf.read(original_path)
        except Exception as e:
            # Skip invalid audio files
            continue
            
        chunk_samples = sr * 4
        total_samples = len(data)
        
        chunk_ids = []
        # Split into chunks of 4 seconds
        for start_idx in range(0, total_samples, chunk_samples):
            chunk_data = data[start_idx : start_idx + chunk_samples]
            
            # Safely pad with zeros (silence) if it's the last chunk and shorter than 4 seconds
            if len(chunk_data) < chunk_samples:
                pad_width = chunk_samples - len(chunk_data)
                if data.ndim == 1:
                    chunk_data = np.pad(chunk_data, (0, pad_width), mode='constant')
                else: # Handle stereo/multi-channel
                    chunk_data = np.pad(chunk_data, ((0, pad_width), (0, 0)), mode='constant')
            
            chunk_id = f"{original_id}_chunk_{len(chunk_ids)}"
            chunk_path = os.path.join(TEMP_DIR, f"{chunk_id}.wav")
            sf.write(chunk_path, chunk_data, sr)
            
            chunk_ids.append(chunk_id)
            parquet_records.append({
                "ID": chunk_id,
                "path": chunk_path,
                "label": "bonafide"  # Dummy label for testing framework
            })
            
        file_chunk_mapping[original_id] = {
            "path": original_path,
            "filename": file.filename,
            "chunk_ids": chunk_ids
        }
        
    if not parquet_records:
        return JSONResponse(status_code=400, content={"error": "No valid audio files were processed."})

    # 2. Create the unified Parquet file targeting all chunks across all files
    parquet_path = os.path.join(TEMP_DIR, "api_batch.parquet")
    pd.DataFrame(parquet_records).to_parquet(parquet_path)
    
    # 3. Dynamically read and update the config file based on workload
    with open(CONFIG_PATH, "r") as f:
        config = yaml.safe_load(f)
        
    total_chunks = len(parquet_records)
    # Set dynamic limits (e.g., max 32 for batch size, max 4 for workers to avoid memory overload)
    optimal_batch = min(32, total_chunks) 
    optimal_workers = min(4, total_chunks)
    
    update_config_params(config, optimal_batch, optimal_workers)
    
    # Save the modified setup to a temporary YAML file
    temp_config_path = os.path.join(TEMP_DIR, "temp_config.yaml")
    with open(temp_config_path, "w") as f:
        yaml.dump(config, f)
        
    # 4. Run DeepFense evaluation using the temporary config
    subprocess.run([
        "deepfense", "test", "--config", temp_config_path, "--checkpoint", CKPT_PATH
    ], check=True)
    
    # 5. Parse the framework's output predictions
    prediction_files_for_csv = glob.glob(os.path.join(PREDICTIONS_DIR, "*.txt"))
    if prediction_files_for_csv:
        selected_file_for_csv = max(prediction_files_for_csv, key=os.path.getctime)
        df_txt = pd.read_csv(selected_file_for_csv, sep=',')
        df_txt.to_csv(os.path.join(PREDICTIONS_DIR, "output.csv"), index=False)
        
    prediction_files = glob.glob(os.path.join(PREDICTIONS_DIR, "*.csv"))
    if not prediction_files:
        return JSONResponse(status_code=500, content={"error": "Prediction outputs not found."})
        
    latest_file = max(prediction_files, key=os.path.getctime)
    pred_df = pd.read_csv(latest_file)
    if len(pred_df.columns) == 1:
        pred_df = pd.read_csv(latest_file, sep=r'\s+')
        
    id_col = 'ID_audio' if 'ID_audio' in pred_df.columns else 'ID'
    OPTIMAL_TAU = 0
    results = []
    
    # 6. Re-assemble chunk scores back to their parent files
    with open(CSV_OUTPUT, mode="a", newline="") as f:
        csv_writer = csv.writer(f)
        
        for orig_id, file_info in file_chunk_mapping.items():
            chunk_scores = []
            for c_id in file_info["chunk_ids"]:
                row = pred_df[pred_df[id_col] == c_id]
                if not row.empty:
                    score = float(row.iloc[0].get('score_class1', 0))
                    chunk_scores.append(score)
            
            if chunk_scores:
                # We calculate the mean score across all chunks
                # Note: You can switch this to min(chunk_scores) if you want to flag 
                # the entire file as spoofed if even *one* chunk drops below the threshold.
                final_score = sum(chunk_scores) / len(chunk_scores)
                final_label = "bonafide" if final_score > OPTIMAL_TAU else "spoof"
                
                results.append({
                    "filename": file_info["filename"],
                    "audio_id": orig_id,
                    "prediction": final_label,
                    "score": final_score
                })
                
                # Append final evaluation to your master CSV tracker
                csv_writer.writerow([orig_id, file_info["path"], final_score, final_label])
                
            # Clean up the original file and its associated chunks
            if os.path.exists(file_info["path"]):
                os.remove(file_info["path"])
            for c_id in file_info["chunk_ids"]:
                chunk_path = os.path.join(TEMP_DIR, f"{c_id}.wav")
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)
                    
    # Clean up the batch configuration files
    if os.path.exists(temp_config_path):
        os.remove(temp_config_path)
    if os.path.exists(parquet_path):
        os.remove(parquet_path)
        
    # 7. Return the combined batch result
    return JSONResponse(content={"results": results})
