import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from parent directory if present, or workspace root
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv()  # fallback to current working directory

# Define Base Directories
BACKEND_DIR = Path(__file__).resolve().parent
WORKSPACE_DIR = BACKEND_DIR.parent
LIFE_DIR = BACKEND_DIR / "life"

# Create snapshots dir if not exists
SNAPSHOTS_DIR = LIFE_DIR / "snapshots"
SNAPSHOTS_DIR.mkdir(exist_ok=True)

# API Configurations
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

# Neon PostgreSQL — optional for local dev, required in production
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.strip("'\"")  # postgresql://user:pass@host/db?sslmode=require

API_SECRET_TOKEN = os.getenv("API_SECRET_TOKEN")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")

# Check and validate
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in environment variables. Please check your .env file.")
if not DATABASE_URL:
    print("INFO: DATABASE_URL not set — running in local-only mode (no Neon sync, SQLite for chat).")
