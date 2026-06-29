"""
LiveKit Agent Worker — livekit-agents v1.x
Pipeline: VAD → STT (OpenAI Whisper) → LLM (GPT-4o-mini) → TTS (OpenAI nova)
RAG context is injected in on_user_turn_completed before each LLM call.
Transcripts and RAG sources are forwarded to the browser via LiveKit data channel.
"""
import asyncio
import json
import logging
from typing import Optional

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    ConversationItemAddedEvent,
    JobContext,
    UserInputTranscribedEvent,
    WorkerOptions,
    cli,
    llm as agents_llm,
)
from livekit.plugins import openai

import kb as knowledge_base
from config import get_system_prompt

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _publish(room, payload: dict) -> None:
    try:
        await room.local_participant.publish_data(
            json.dumps(payload).encode(), reliable=True
        )
    except Exception as exc:
        logger.warning("Data publish failed: %s", exc)


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------


class NeuroDriftAgent(Agent):
    """Voice agent with automatic RAG injection on every user turn."""

    def __init__(self, *, instructions: str, room=None):
        super().__init__(
            instructions=instructions,
            stt=openai.STT(model="whisper-1"),
            llm=openai.LLM(model="gpt-4o-mini"),
            tts=openai.TTS(voice="nova"),
        )
        self._room = room  # stored so on_user_turn_completed can publish without get_job_context()

    async def on_user_turn_completed(
        self,
        turn_ctx: agents_llm.ChatContext,
        new_message: agents_llm.ChatMessage,
    ) -> None:
        query = new_message.text_content or ""
        logger.info("RAG: query='%s'", query)
        if not query.strip():
            return

        try:
            chunks = await knowledge_base.async_retrieve(query, 4)
        except Exception as exc:
            logger.warning("RAG retrieve failed: %s", exc)
            return

        logger.info("RAG: retrieved %d chunk(s)", len(chunks))
        if not chunks:
            logger.info("RAG: no chunks in KB, responding without context")
            return

        rag_body = "\n\n".join(
            f"[Source: {c['source']}]\n{c['text']}" for c in chunks
        )
        logger.info("RAG: injecting %d chars of context", len(rag_body))

        turn_ctx.add_message(
            role="system",
            content=(
                "DOCUMENT CONTEXT RETRIEVED — answer the user's question using this:\n"
                "---\n"
                + rag_body
                + "\n---\n"
                "This context IS available. Extract the specific answer from it. "
                "Do NOT say the information is unavailable or not mentioned."
            ),
        )

        if self._room:
            await _publish(
                self._room,
                {
                    "type": "rag_sources",
                    "sources": [
                        {"source": c["source"], "snippet": c["text"][:300]}
                        for c in chunks
                    ],
                },
            )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


async def entrypoint(ctx: JobContext):
    # Always read from file first (source of truth).
    # Dispatch metadata overrides only when explicitly set.
    system_prompt = get_system_prompt()
    if ctx.job.metadata:
        try:
            meta = json.loads(ctx.job.metadata)
            dispatched = meta.get("system_prompt", "").strip()
            if dispatched:
                system_prompt = dispatched
        except Exception:
            pass

    logger.info("Agent starting in room '%s' | prompt length=%d", ctx.room.name, len(system_prompt))

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    participant = await ctx.wait_for_participant()
    logger.info("Participant joined: %s", participant.identity)

    # Pass room reference so the agent can publish RAG sources directly
    agent = NeuroDriftAgent(instructions=system_prompt, room=ctx.room)
    session = AgentSession()

    @session.on("user_input_transcribed")
    def _on_user_transcript(ev: UserInputTranscribedEvent):
        if ev.is_final:
            asyncio.create_task(_publish(
                ctx.room,
                {"type": "transcript", "role": "user", "text": ev.transcript},
            ))

    @session.on("conversation_item_added")
    def _on_conversation_item(ev: ConversationItemAddedEvent):
        item = ev.item
        if not isinstance(item, agents_llm.ChatMessage):
            return
        if item.role != "assistant":
            return
        text = item.text_content
        if text:
            asyncio.create_task(_publish(
                ctx.room,
                {"type": "transcript", "role": "assistant", "text": text},
            ))

    await session.start(agent, room=ctx.room)
    session.say(
        "Hello! I'm your NeuroDrift assistant. "
        "I can answer questions using your uploaded documents. "
        "How can I help you?"
    )


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="neurodrift-agent",
        )
    )
