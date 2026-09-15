FROM python:3.10-slim

WORKDIR /app
COPY . /app
RUN ls
RUN pip install -e .
RUN pip install fastapi uvicorn python-multipart pandas pyarrow 
WORKDIR /app/parquet_maker
RUN python3 parquet_maker.py
RUN python3 parquet_maker_for_deepfense.py
RUN cd ..

RUN deepfense test \
  --config /app/models/config.yaml \
  --checkpoint /app/models/best_model.pth


