"""
Knowledge Base: document ingestion, chunking, embedding, and retrieval via ChromaDB.
"""
import io
import json
import logging
import uuid
from pathlib import Path
from typing import Any

import chromadb
from openai import OpenAI, AsyncOpenAI

from config import CHROMA_DIR, DOCS_FILE, OPENAI_API_KEY

logger = logging.getLogger(__name__)

_openai = OpenAI(api_key=OPENAI_API_KEY)
_async_openai = AsyncOpenAI(api_key=OPENAI_API_KEY)
_chroma = chromadb.PersistentClient(path=str(CHROMA_DIR))
_col = _chroma.get_or_create_collection(
    "knowledge_base",
    metadata={"hnsw:space": "cosine"},
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _embed(text: str) -> list[float]:
    resp = _openai.embeddings.create(model="text-embedding-3-small", input=text)
    return resp.data[0].embedding


async def _async_embed(text: str) -> list[float]:
    resp = await _async_openai.embeddings.create(model="text-embedding-3-small", input=text)
    return resp.data[0].embedding


def _chunk(text: str, size: int = 400, overlap: int = 60) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + size])
        if len(chunk.strip()) >= 40:
            chunks.append(chunk)
        i += size - overlap
    return chunks


def _load_meta() -> list[dict]:
    if DOCS_FILE.exists():
        return json.loads(DOCS_FILE.read_text(encoding="utf-8"))
    return []


def _save_meta(docs: list[dict]) -> None:
    DOCS_FILE.write_text(json.dumps(docs, indent=2, ensure_ascii=False), encoding="utf-8")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def ingest(filename: str, text: str) -> str:
    """Chunk, embed, and store a document. Returns the document ID."""
    chunks = _chunk(text)
    if not chunks:
        raise ValueError("No usable text extracted from document.")

    doc_id = str(uuid.uuid4())
    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    embeddings = [_embed(c) for c in chunks]
    metadatas = [{"doc_id": doc_id, "filename": filename, "chunk_index": i} for i in range(len(chunks))]

    _col.upsert(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)

    docs = _load_meta()
    docs.append({"id": doc_id, "filename": filename, "chunk_count": len(chunks)})
    _save_meta(docs)

    logger.info("Ingested '%s' → %d chunks (doc_id=%s)", filename, len(chunks), doc_id)
    return doc_id


def retrieve(query: str, n: int = 4) -> list[dict[str, Any]]:
    """Return the top-n most relevant chunks for *query*."""
    total = _col.count()
    if total == 0:
        return []

    results = _col.query(
        query_embeddings=[_embed(query)],
        n_results=min(n, total),
        include=["documents", "metadatas", "distances"],
    )

    out: list[dict[str, Any]] = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        out.append(
            {
                "text": doc,
                "source": meta["filename"],
                "doc_id": meta["doc_id"],
                "relevance": round(1.0 - float(dist), 3),
            }
        )
    return out


async def async_retrieve(query: str, n: int = 4) -> list[dict[str, Any]]:
    """Async version of retrieve — uses AsyncOpenAI so it never blocks the event loop."""
    total = _col.count()
    if total == 0:
        return []

    embedding = await _async_embed(query)
    results = _col.query(
        query_embeddings=[embedding],
        n_results=min(n, total),
        include=["documents", "metadatas", "distances"],
    )

    out: list[dict[str, Any]] = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        out.append(
            {
                "text": doc,
                "source": meta["filename"],
                "doc_id": meta["doc_id"],
                "relevance": round(1.0 - float(dist), 3),
            }
        )
    return out


def list_documents() -> list[dict]:
    return _load_meta()


def delete_document(doc_id: str) -> bool:
    docs = _load_meta()
    doc = next((d for d in docs if d["id"] == doc_id), None)
    if not doc:
        return False

    ids_to_delete = [f"{doc_id}_{i}" for i in range(doc["chunk_count"])]
    try:
        _col.delete(ids=ids_to_delete)
    except Exception as exc:
        logger.warning("ChromaDB delete partial failure: %s", exc)

    _save_meta([d for d in docs if d["id"] != doc_id])
    return True


# ---------------------------------------------------------------------------
# Document parsers
# ---------------------------------------------------------------------------


def parse_file(filename: str, content: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return _parse_pdf(content)
    if lower.endswith(".docx"):
        return _parse_docx(content)
    return content.decode("utf-8", errors="replace")


def _parse_pdf(content: bytes) -> str:
    try:
        from pdfminer.high_level import extract_text  # type: ignore

        return extract_text(io.BytesIO(content)) or ""
    except Exception:
        try:
            import PyPDF2  # type: ignore

            reader = PyPDF2.PdfReader(io.BytesIO(content))
            return "\n".join(p.extract_text() or "" for p in reader.pages)
        except Exception as exc:
            logger.error("PDF parse failed: %s", exc)
            return ""


def _parse_docx(content: bytes) -> str:
    try:
        import docx  # type: ignore

        doc = docx.Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as exc:
        logger.error("DOCX parse failed: %s", exc)
        return ""
