import os
import pandas as pd
import librosa

# 1. Define your dataset path and labels
base_dir = os.getcwd()
categories = {"bonafide": 0, "spoof": 1}
data = []

# 2. Iterate through folders and process files
for category, label in categories.items():
    folder_path = os.path.join(base_dir, category)
    
    if not os.path.isdir(folder_path):
        continue
        
    for filename in os.listdir(folder_path):
        if filename.endswith((".wav", ".mp3", ".flac")):
            file_path = os.path.join(folder_path, filename)
            
            # RECOMMENDED (Memory Efficient): Store paths and labels only
            data.append({
                "file_path": file_path, 
                "label": label
            })
            
            # ALTERNATIVE: Embed actual audio arrays (Only for smaller datasets)
            # waveform, sr = librosa.load(file_path, sr=16000)
            # data.append({
            #     "file_path": file_path, 
            #     "label": label,
            #     "waveform": waveform.tolist(), # Convert numpy array to list for Parquet
            #     "sr": sr
            # })

# 3. Convert to DataFrame and save
df = pd.DataFrame(data)
df.to_parquet("audio_dataset.parquet", engine="pyarrow")
print(f"Saved {len(df)} records to audio_dataset.parquet")
