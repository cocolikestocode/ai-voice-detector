FROM python:3.10-slim

WORKDIR /app
COPY . /app

# Install OS dependencies
RUN apt-get update && apt-get install -y git wget libsndfile1

# Step 1: Download the DeepFense repository
RUN git clone https://github.com/Yaselley/deepfense-framework

WORKDIR /app/deepfense-framework

# Step 2: Install framework and API dependencies
RUN pip install -e .
RUN pip install fastapi uvicorn python-multipart pandas pyarrow 

# Step 3: Download the tuned checkpoint
RUN deepfense download model ASV5_WavLM_AASIST_NoAug_Seed42

# Step 4: Download WavLM-Large.pt into a new folder
RUN mkdir -p pretrained_models && \
    wget -O pretrained_models/WavLM-Large.pt https://github.com/bshall/knn-vc/releases/download/v0.1/WavLM-Large.pt

# Step 5: Update the config.yaml to point to WavLM and define the API Parquet dataset
RUN python -c "\
import yaml; \
path = 'models/ASV5_WavLM_AASIST_NoAug_Seed42/config.yaml'; \
doc = yaml.safe_load(open(path)); \
doc['model']['frontend']['args']['ckpt_path'] = '/app/deepfense-framework/pretrained_models/WavLM-Large.pt'; \
doc['data'] = doc.get('data', {}); \
doc['data']['test'] = { \
    'dataset_type': 'StandardDataset', \
    'dataset_names': ['API_Realtime'], \
    'parquet_files': ['/app/deepfense-framework/temp_audio/api_batch.parquet'], \
    'batch_size': 1, 'shuffle': False, 'num_workers': 1, \
    'base_transform': [{'type': 'pad', 'max_len': 64000, 'pad_type': 'repeat'}] \
}; \
doc['data']['label_map'] = {'spoof': 0, 'bonafide': 1}; \
doc['data']['sampling_rate'] = 16000; \
yaml.dump(doc, open(path, 'w'))"

# Step 6: Create audio and results directories
RUN mkdir -p temp_audio results

# Copy the API server script into the container
COPY api_server.py .

# Expose port and start the API
EXPOSE 8000
ENTRYPOINT ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"]
