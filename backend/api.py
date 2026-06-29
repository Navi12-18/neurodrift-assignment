"""
FastAPI server - handles token generation, document management, and prompt CRUD.
"""
import json
import logging

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import kb as knowledge_base
from config import (
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    LIVEKIT_URL,
    OPENAI_API_KEY,
    get_system_prompt,
    set_system_prompt,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="NeuroDrift API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class TokenRequest(BaseModel):
    room_name: str
    identity: str = "user"


class PromptBody(BaseModel):
    prompt: str


# ---------------------------------------------------------------------------
# Token + agent dispatch
# ---------------------------------------------------------------------------


@app.post("/api/token")
async def create_token(req: TokenRequest):
    """Generate a LiveKit access token and dispatch the agent to the room."""
    from livekit.api import AccessToken, VideoGrants

    system_prompt = get_system_prompt()

    token = (
        AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(req.identity)
        .with_name(req.identity)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=req.room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )

    # Dispatch agent - wrapped in try/except so a version mismatch is non-fatal
    await _dispatch_agent(req.room_name, system_prompt)

    return {"token": token, "url": LIVEKIT_URL, "room_name": req.room_name}


async def _dispatch_agent(room_name: str, system_prompt: str) -> None:
    try:
        from livekit.api import LiveKitAPI
        from livekit.protocol.agent_dispatch import CreateAgentDispatchRequest

        async with LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        ) as api:
            await api.agent_dispatch.create_dispatch(
                CreateAgentDispatchRequest(
                    room=room_name,
                    agent_name="neurodrift-agent",
                    metadata=json.dumps({"system_prompt": system_prompt}),
                )
            )
        logger.info("Agent dispatched to room '%s'", room_name)
    except Exception as exc:
        # Dispatch may fail if the agent worker hasn't registered yet or is
        # running in a version that doesn't support explicit dispatch.
        logger.warning("Agent dispatch skipped (%s) - ensure agent worker is running.", exc)


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------


@app.get("/api/prompt")
async def get_prompt():
    return {"prompt": get_system_prompt()}


@app.put("/api/prompt")
async def update_prompt(body: PromptBody):
    if not body.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")
    set_system_prompt(body.prompt)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Knowledge base
# ---------------------------------------------------------------------------


@app.post("/api/kb/upload")
async def upload_document(file: UploadFile = File(...)):
    filename = file.filename or "document"
    raw = await file.read()

    text = knowledge_base.parse_file(filename, raw)
    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from the uploaded file.")

    doc_id = knowledge_base.ingest(filename, text)
    return {"status": "ok", "id": doc_id, "filename": filename}


@app.get("/api/kb/documents")
async def list_documents():
    return {"documents": knowledge_base.list_documents()}


@app.delete("/api/kb/documents/{doc_id}")
async def delete_document(doc_id: str):
    if not knowledge_base.delete_document(doc_id):
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"status": "ok"}


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "livekit_url": LIVEKIT_URL,
        "openai_configured": bool(OPENAI_API_KEY),
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
