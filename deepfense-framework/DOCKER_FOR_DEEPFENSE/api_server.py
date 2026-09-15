from fastapi import FastAPI, UploadFile, File
import os, shutil, uuid, subprocess, csv, glob
import pandas as pd
from fastapi.responses import JSONResponse

app = FastAPI()

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

@app.post("/predict")
async def predict_audio(file: UploadFile = File(...)):
    # 6. Save incoming audio to temp_audio
    audio_id = str(uuid.uuid4())[:8]
    ext = os.path.splitext(file.filename)[1]
    audio_path = os.path.join(TEMP_DIR, f"{audio_id}{ext}")
    
    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 7. Create the Parquet file targeting this specific audio
    parquet_path = os.path.join(TEMP_DIR, "api_batch.parquet")
    pd.DataFrame([{
        "ID": audio_id,
        "path": audio_path,
        "label": "bonafide"  # Required dummy label for DeepFense testing
    }]).to_parquet(parquet_path)
    
    # Run DeepFense evaluation
    subprocess.run([
        "deepfense", "test", "--config", CONFIG_PATH, "--checkpoint", CKPT_PATH
    ], check=True)
    

    #changing the output to csv    
    pred_dir = os.getcwd()
    prediction_files_for_csv = glob.glob(os.path.join(pred_dir, "*.txt"))
    selected_file_for_csv = max(prediction_files_for_csv, key=os.path.getctime)
    df = pd.read_csv(selected_file_for_csv, sep=',')

    # Export it as a CSV file
    df.to_csv('output.csv', index=False)
    
    # Parse the framework's output predictions
    prediction_files = glob.glob(os.path.join(PREDICTIONS_DIR, "*.csv"))
    score = 0.0
    label = "Unknown"
    
    if prediction_files:
        latest_file = max(prediction_files, key=os.path.getctime)
        
        # Robustly read CSV to handle both comma and space-separated formats
        pred_df = pd.read_csv(latest_file)
        if len(pred_df.columns) == 1:
            pred_df = pd.read_csv(latest_file, sep=r'\s+')
            
        # The output CSV renames the identifier column to 'ID_audio'
        id_col = 'ID_audio' if 'ID_audio' in pred_df.columns else 'ID'
        row = pred_df[pred_df[id_col] == audio_id]
        
        if not row.empty:
            # Extract the logit for the bonafide class
            score = float(row.iloc[0].get('score_class1', 0))
            
            # Apply the optimal EER threshold calculated from your benchmark
            OPTIMAL_TAU = 3.7336
            label = "bonafide" if score > OPTIMAL_TAU else "spoof" 
            
    # Append to central results CSV
    with open(CSV_OUTPUT, mode="a", newline="") as f:
        csv.writer(f).writerow([audio_id, audio_path, score, label])
        
    # Cleanup temporary file safely
    if os.path.exists(audio_path):
        os.remove(audio_path)
    
    return JSONResponse(content={"audio_id": audio_id, "prediction": label, "score": score})
