# NeuroDrift — Real-Time Voice AI Agent

End-to-end voice agent with WebRTC (LiveKit), RAG over uploaded documents, and a React UI.

## Architecture

```
Browser (React)
    ↕ WebRTC (LiveKit)
LiveKit Server ──── Agent Worker (Python)
                         ├── STT  : OpenAI Whisper (whisper-1)
                         ├── LLM  : OpenAI GPT-4o-mini
                         ├── TTS  : OpenAI TTS (nova)
                         └── RAG  : ChromaDB + OpenAI embeddings (text-embedding-3-small)

FastAPI Server
    ├── POST /api/token          → LiveKit JWT + agent dispatch
    ├── GET|PUT /api/prompt      → system prompt CRUD
    ├── POST /api/kb/upload      → ingest document
    ├── GET /api/kb/documents    → list documents
    └── DELETE /api/kb/documents/{id}
```

**RAG flow:** Every time the user speaks, the agent retrieves the top-4 most relevant
chunks from ChromaDB (cosine similarity on OpenAI embeddings) and injects them into the
system message before the LLM call. Retrieved chunks are also forwarded to the browser
via a LiveKit data channel and shown in the "RAG Sources" panel.

---

## Prerequisites

| Dependency | Version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| LiveKit Server | cloud or self-hosted |

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values:

```bash
cp backend/.env.example backend/.env
```

| Variable | Description |
|---|---|
| `LIVEKIT_URL` | WebSocket URL of your LiveKit server (`ws://localhost:7880`) |
| `LIVEKIT_API_KEY` | LiveKit API key (`devkey` for local dev) |
| `LIVEKIT_API_SECRET` | LiveKit API secret (`secret` for local dev) |
| `OPENAI_API_KEY` | OpenAI key — used for Whisper STT, GPT-4o-mini LLM, TTS, and embeddings |

---

## Running locally (without Docker)

### 1. LiveKit Setup

**Option A — LiveKit Cloud (recommended, no install needed)**
1. Sign up at [livekit.io/cloud](https://livekit.io/cloud)
2. Create a project and copy the WebSocket URL, API Key, and API Secret into `backend/.env`

**Option B — Self-hosted**
```bash
# macOS/Linux
brew install livekit && livekit-server --dev

# Docker
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_KEYS="devkey:secret" livekit/livekit-server --dev --bind 0.0.0.0
```

### 2. Backend — API server

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt

cp .env.example .env   # then fill in your keys

python api.py
# → API listening on http://localhost:8000
```

### 3. Backend — Agent Worker

In a separate terminal (same virtualenv):

```bash
cd backend
python agent.py start
# → Agent worker connected to LiveKit, waiting for jobs
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Running with Docker Compose

```bash
# 1. Create the env file
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# 2. Build and start all services
docker compose up --build
```

Services:
- **LiveKit** — `ws://localhost:7880`
- **API** — `http://localhost:8000`
- **Frontend** — `http://localhost:3000`

---

## Usage

1. **Upload documents** — drag & drop PDFs, TXT, or DOCX files into the Knowledge Base panel. Each document is chunked, embedded, and stored in ChromaDB.
2. **Edit system prompt** — customize the agent's persona and instructions in the System Prompt panel and click **Save**.
3. **Start a call** — click **Start Call**. The frontend connects to LiveKit and the agent worker joins the room automatically.
4. **Talk** — click the microphone button and ask a question. If relevant documents are in the KB, the agent retrieves them and answers using that context.
5. **See RAG sources** — after each answer, the "RAG Sources Used" panel shows which document chunks were retrieved.

---

## Project Structure

```
neurodrift/
├── backend/
│   ├── agent.py        # LiveKit agent worker (STT→LLM→TTS pipeline)
│   ├── api.py          # FastAPI server
│   ├── kb.py           # Knowledge base: ingestion + retrieval
│   ├── config.py       # Shared config and settings
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VoiceRoom.tsx     # LiveKit room + mic control
│   │   │   ├── KnowledgeBase.tsx # Document upload/management
│   │   │   ├── PromptEditor.tsx  # System prompt editor
│   │   │   ├── Transcript.tsx    # Live transcript
│   │   │   └── RagSources.tsx    # Retrieved chunks panel
│   │   ├── lib/api.ts            # API client
│   │   └── App.tsx               # Root layout + state
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Known Limitations / Tradeoffs

- **Agent dispatch** — explicit dispatch via `livekit.protocol.agent.CreateAgentDispatchRequest` requires `livekit-api>=0.7.0`. If your version does not support this, configure the LiveKit server with auto-dispatch rules or trigger dispatch manually.
- **Shared data volume** — the API server and agent worker share the `data/` directory for ChromaDB and the system prompt file. In production, replace with a shared network volume or a remote vector store (Pinecone, Weaviate).
- **Embeddings cost** — every uploaded document chunk calls OpenAI's embedding API. For large knowledge bases, consider batching or a local embedding model (e.g., `sentence-transformers`).
- **No authentication** — the API is open. Add an auth layer before exposing to the internet.
- **Single room** — each call creates a new LiveKit room. Multi-room session management is not implemented.
- **Transcript persistence** — transcripts live in React state only and are lost on page refresh.
