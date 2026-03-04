FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip certifi && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Run migrations and start app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

