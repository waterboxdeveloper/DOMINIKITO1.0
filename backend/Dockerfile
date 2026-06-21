# Use official lightweight Python image
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    HOST=0.0.0.0

WORKDIR /app

# Install system dependencies if required (none needed for pure Python libs)
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     build-essential \
#     && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend code (including api.py, agents/, web/, taxonomy.py, schemas.py, etc.)
COPY . .

# Expose the API port
EXPOSE 8080

# Command to run uvicorn through python api.py
# (api.py has its own uvicorn.run call configured to read HOST and PORT env vars)
CMD ["python", "api.py"]
