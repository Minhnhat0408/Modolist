# AI Service

Python-based AI service for the todolist application.

## Setup

```bash
# Install Python dependencies
pip install -r requirements.txt
# or
pip3 install -r requirements.txt
```

## Development

```bash
# From root of monorepo
pnpm dev --filter=ai-service

# Or directly
python3 main.py
```

## Build/Deploy

This is a Python service. For production:

1. Install dependencies: `pip install -r requirements.txt`
2. Run with: `python3 main.py` or use a production server like `gunicorn` or `uvicorn`
