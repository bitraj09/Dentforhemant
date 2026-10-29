FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOME=/home/appuser
ENV TORCH_HOME=/home/appuser/.cache/torch
ENV HF_HOME=/home/appuser/.cache/huggingface

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
# Use CPU-only PyTorch wheels; the Compose service has no GPU allocation.
RUN python -m pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu \
      --extra-index-url https://pypi.org/simple \
      torch==2.13.0 torchvision==0.28.0 \
    && grep -v -E '^(torch|torchvision)$' requirements.txt > /tmp/requirements.txt \
    && python -m pip install --no-cache-dir --default-timeout=1000 -r /tmp/requirements.txt

COPY . ./

RUN groupadd -r appuser && useradd --system --create-home --home-dir /home/appuser -g appuser appuser \
    && mkdir -p /home/appuser/.cache/torch /home/appuser/.cache/huggingface \
    && chown -R appuser:appuser /app /home/appuser

USER appuser

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
