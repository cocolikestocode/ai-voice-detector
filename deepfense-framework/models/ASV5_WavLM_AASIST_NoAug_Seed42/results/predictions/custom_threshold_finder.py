import glob
import os
import numpy as np
import pandas as pd
from sklearn.metrics import roc_curve

# 1. Locate the latest predictions file produced by DeepFense
pred_dir = os.getcwd()
prediction_files = glob.glob(os.path.join(pred_dir, "*.txt"))
for idx , file_path in enumerate(prediction_files):
	file_name = os.path.basename(file_path)
	print(f"[{idx}] {file_name}")
user_choice = int(input("\nEnter the file number : "))
selected_file = prediction_files[user_choice]
df = pd.read_csv(selected_file, sep=',')

# Export it as a CSV file
df.to_csv('output.csv', index=False)
df = pd.read_csv('output.csv')
# 2. Extract true labels (1 = bonafide, 0 = spoof) and predicted logits/scores
# DeepFense CSVs typically have columns like 'label' and 'score' (or 'logit')
score_col = "logit" if "logit" in df.columns else "score"

y_true = df["label"].map({"bonafide": 1, "spoof": 0}).values
y_scores = df[score_col].values

# 3. Compute ROC curve (FPR = FAR, TPR = 1 - FRR)
fpr, tpr, thresholds = roc_curve(y_true, y_scores, pos_label=1)
fnr = 1 - tpr  # FRR

# 4. Find the index where FAR (fpr) and FRR (fnr) are closest
eer_index = np.nanargmin(np.abs(fpr - fnr))

optimal_threshold = thresholds[eer_index]
calculated_eer = (fpr[eer_index] + fnr[eer_index]) / 2

print("\n--- EER Threshold Results ---")
print(f"Optimal Threshold (Tau) : {optimal_threshold:.4f}")
print(f"Equal Error Rate (EER)  : {calculated_eer * 100:.2f}%")
print(f"FAR at this threshold   : {fpr[eer_index] * 100:.2f}%")
print(f"FRR at this threshold   : {fnr[eer_index] * 100:.2f}%")
