# Stage 1: Install dependencies
FROM python:3.12.9-slim@sha256:48006ff57afe15f247ad3da166e9487da0f66a94adbc92810b0e189382d79246 AS builder

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

# Download spaCy model in build stage so it's baked into the image
RUN python -m spacy download en_core_web_sm

# Stage 2: Runtime
FROM python:3.12.9-slim@sha256:48006ff57afe15f247ad3da166e9487da0f66a94adbc92810b0e189382d79246

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY src/ src/
COPY data/ data/

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
