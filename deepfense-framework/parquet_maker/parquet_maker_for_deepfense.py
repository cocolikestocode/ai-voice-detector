import pandas as pd

df = pd.read_parquet("audio_dataset.parquet")
# Rename the file path column
df = df.rename(columns={"file_path": "path"})
# Convert numeric labels (0/1) to DeepFense string formats
df["label"] = df["label"].map({0: "bonafide", 1: "spoof"})
# Add a unique ID column
df["ID"] = "audio_" + df.index.astype(str) 

df.to_parquet("deepfense_test.parquet")
