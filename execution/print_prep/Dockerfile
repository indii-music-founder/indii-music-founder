# syntax=docker/dockerfile:1.4
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    wget \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/python3.11 /usr/bin/python3 && ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Install PyTorch with CUDA 12.4 support
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cu124

# Install FastAPI, Google Cloud SDKs, Spandrel, Pillow, OpenCV
RUN pip3 install --no-cache-dir \
    fastapi==0.115.11 \
    uvicorn[standard]==0.34.0 \
    pydantic==2.10.6 \
    spandrel==0.4.2 \
    opencv-python-headless==4.11.0.86 \
    pillow==11.1.0 \
    google-cloud-storage==2.19.0 \
    google-cloud-firestore==2.20.0

# Pre-bake Real-ESRGAN weights into container
RUN mkdir -p /app/models && \
    wget -q https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -O /app/models/RealESRGAN_x4plus.pth && \
    wget -q https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth -O /app/models/RealESRGAN_x4plus_anime_6B.pth

COPY print_prep.py upscale.py worker.py /app/execution/print_prep/

ENV MODEL_DIR=/app/models
ENV PORT=8080

EXPOSE 8080

CMD ["uvicorn", "execution.print_prep.worker:app", "--host", "0.0.0.0", "--port", "8080"]
