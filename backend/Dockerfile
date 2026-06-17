# Stage 1: Build dependencies
FROM python:3.10-slim AS builder
#We use python:3.10-slim, which is a lightweight Linux operating system with Python 3.10 pre-installed.
WORKDIR /app

# Install build dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Final image
FROM python:3.10-slim AS final

WORKDIR /app

# Copy installed python dependencies from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy backend application files
COPY . .

# Expose port
EXPOSE 5000

# Set environment variables for production
ENV ENV=production
ENV HOST=0.0.0.0
ENV PORT=5000

# Start server using the entrypoint run.py script
CMD ["python", "run.py"]
