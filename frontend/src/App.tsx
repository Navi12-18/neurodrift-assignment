import { useState, useCallback } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { Mic, Zap } from "lucide-react";

import { api, type TokenResponse } from "./lib/api";
import KnowledgeBase from "./components/KnowledgeBase";
import PromptEditor from "./components/PromptEditor";
import VoiceRoom from "./components/VoiceRoom";
import Transcript from "./components/Transcript";
import RagSources from "./components/RagSources";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
}

export interface RagSource {
  source: string;
  snippet: string;
}

export default function App() {
  const [session, setSession] = useState<TokenResponse | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [ragSources, setRagSources] = useState<RagSource[]>([]);

  const handleStartCall = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const roomName = `nd-${Date.now()}`;
      const tok = await api.getToken(roomName);
      setSession(tok);
      setTranscript([]);
      setRagSources([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start call");
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setSession(null);
  }, []);

  const handleData = useCallback((payload: Uint8Array) => {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload)) as {
        type: string;
        role?: "user" | "assistant";
        text?: string;
        sources?: RagSource[];
      };
      if (msg.type === "transcript" && msg.role && msg.text) {
        setTranscript((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random()}`, role: msg.role!, text: msg.text!, ts: Date.now() },
        ]);
      } else if (msg.type === "rag_sources" && msg.sources) {
        setRagSources(msg.sources);
      }
    } catch { /* malformed */ }
  }, []);

  return (
    <div className="min-h-screen bg-surface bg-grid flex flex-col">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px]
                        bg-brand/8 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-surface-border/60 px-6 py-3.5
                         bg-surface/80 backdrop-blur-md flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand/20 border border-brand/30 flex items-center
                          justify-center shadow-[0_0_16px_rgba(99,102,241,0.3)]">
            <Zap size={15} className="text-brand-light" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none">NeuroDrift</h1>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">Real-Time Voice AI · RAG</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {session ? (
            <span className="flex items-center gap-1.5 badge bg-emerald-500/15 text-emerald-400
                             border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="badge bg-surface-hover text-slate-500 border border-surface-border">
              Idle
            </span>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px]
                       gap-3 p-3 min-h-0">
        {/* Left — Knowledge Base */}
        <aside className="flex flex-col gap-3 min-h-0">
          <KnowledgeBase />
        </aside>

        {/* Center — Voice + Transcript */}
        <section className="flex flex-col gap-3 min-h-0">
          {session ? (
            <LiveKitRoom
              token={session.token}
              serverUrl={session.url}
              connect={true}
              audio={true}
              video={false}
              onDisconnected={handleDisconnect}
              onError={(e) => setError(e.message)}
            >
              <RoomAudioRenderer />
              <VoiceRoom onDisconnect={handleDisconnect} onData={handleData} />
              <Transcript entries={transcript} />
            </LiveKitRoom>
          ) : (
            <IdleHero error={error} connecting={connecting} onStart={handleStartCall} />
          )}
        </section>

        {/* Right — Prompt + RAG */}
        <aside className="flex flex-col gap-3 min-h-0">
          <PromptEditor />
          <RagSources sources={ragSources} />
        </aside>
      </main>
    </div>
  );
}

function IdleHero({
  error,
  connecting,
  onStart,
}: {
  error: string | null;
  connecting: boolean;
  onStart: () => void;
}) {
  return (
    <div className="card flex-1 flex flex-col items-center justify-center gap-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-brand/5 blur-3xl" />
      </div>

      {/* Animated orb */}
      <div className="relative flex items-center justify-center">
        <span className="absolute w-32 h-32 rounded-full bg-brand/10 animate-ring-1" />
        <span className="absolute w-32 h-32 rounded-full bg-brand/10 animate-ring-2" />
        <span className="absolute w-32 h-32 rounded-full bg-brand/10 animate-ring-3" />
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-brand to-indigo-800
                        flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.5)]
                        animate-orb-breathe">
          <Mic size={32} className="text-white" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Start a Voice Session</h2>
        <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
          Upload documents to the knowledge base, tweak your system prompt, then talk to your AI agent.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl
                        px-4 py-3 text-sm max-w-sm text-center animate-fade-up">
          {error}
        </div>
      )}

      <button
        className="btn-primary flex items-center gap-2 text-sm px-7 py-3"
        onClick={onStart}
        disabled={connecting}
      >
        <Mic size={16} />
        {connecting ? "Connecting…" : "Start Call"}
      </button>
    </div>
  );
}
