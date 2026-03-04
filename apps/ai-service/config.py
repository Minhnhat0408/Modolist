import os
import logging

from dotenv import load_dotenv
from google import genai

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ai-service")

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
PORT: int = int(os.getenv("PORT", "50051"))
HOST: str = os.getenv("HOST", "0.0.0.0")

GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
EMBEDDING_MODEL: str = "gemini-embedding-001"
EMBEDDING_DIMENSION: int = 3072

client = genai.Client(api_key=GEMINI_API_KEY)
