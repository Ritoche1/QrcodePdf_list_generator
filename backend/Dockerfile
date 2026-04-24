FROM python:3.12-slim

# Install system dependencies for Pillow, pdf2image, and poppler
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    poppler-utils \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directories (overridden by volume mount in production)
RUN mkdir -p /data/files/qr /data/files/pdf /data/files/export

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
