# Python AI Service Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY apps/ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proto file
COPY proto/ai_service.proto /app/proto/ai_service.proto

# Copy application code
COPY apps/ai-service/ .

# Generate proto stubs AFTER copying app code (so generated files are always fresh)
RUN python -m grpc_tools.protoc \
    -I/app/proto \
    --python_out=/app \
    --grpc_python_out=/app \
    /app/proto/ai_service.proto

# Expose gRPC port
EXPOSE 50051

CMD ["python3", "main.py"]
