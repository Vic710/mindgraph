# Use a slim Python base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install build dependencies for C-extensions (needed for database drivers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements first to leverage Docker caching
COPY backend/requirements.txt ./backend/requirements.txt

# Install python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend ./backend

# Expose backend port
EXPOSE 8000

# Set production environment variables
ENV HOST=0.0.0.0
ENV PORT=8000

# Run the backend FastAPI application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
