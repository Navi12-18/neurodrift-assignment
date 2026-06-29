import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "ws://localhost:7880")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "secret")
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

# Absolute path so subprocesses with different cwd still find the right dir
_HERE = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", str(_HERE / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

CHROMA_DIR = DATA_DIR / "chroma"
PROMPT_FILE = DATA_DIR / "system_prompt.txt"
DOCS_FILE = DATA_DIR / "documents.json"

DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful voice assistant. "
    "Your responses will be spoken aloud, so keep them concise and natural — "
    "avoid bullet lists, markdown, or long explanations unless asked. "
    "When the knowledge base context is provided, use it to give accurate, "
    "specific answers. If the context does not cover the question, say so clearly."
)


def get_system_prompt() -> str:
    if PROMPT_FILE.exists():
        text = PROMPT_FILE.read_text(encoding="utf-8").strip()
        if text:
            return text
    return DEFAULT_SYSTEM_PROMPT


def set_system_prompt(prompt: str) -> None:
    PROMPT_FILE.write_text(prompt.strip(), encoding="utf-8")
