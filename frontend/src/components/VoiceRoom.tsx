import { useEffect, useCallback } from "react";
import {
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
  useVoiceAssistant,
  BarVisualizer,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent } from "livekit-client";
import { Mic, MicOff, PhoneOff } from "lucide-react";

interface Props {
  onDisconnect: () => void;
  onData: (payload: Uint8Array) => void;
}

const AGENT_STATES: Record<string, { label: string; color: string; dot: string; orb: string; anim: string }> = {
  disconnected: {
    label: "Agent offline",
    color: "text-slate-500",
    dot: "bg-slate-600",
    orb: "from-slate-700 to-slate-800",
    anim: "",
  },
  connecting: {
    label: "Agent connecting…",
    color: "text-amber-400",
    dot: "bg-amber-400 animate-pulse",
    orb: "from-amber-600/40 to-amber-900/40",
    anim: "animate-orb-breathe",
  },
  initializing: {
    label: "Initializing…",
    color: "text-indigo-400",
    dot: "bg-indigo-400 animate-pulse",
    orb: "from-indigo-600/50 to-indigo-900/50",
    anim: "animate-orb-think",
  },
  listening: {
    label: "Listening",
    color: "text-emerald-400",
    dot: "bg-emerald-400 animate-pulse",
    orb: "from-emerald-600/40 to-emerald-900/40",
    anim: "animate-orb-breathe",
  },
  thinking: {
    label: "Thinking…",
    color: "text-brand-light",
    dot: "bg-brand animate-spin-slow",
    orb: "from-brand/50 to-indigo-900/50",
    anim: "animate-orb-think",
  },
  speaking: {
    label: "Speaking",
    color: "text-sky-400",
    dot: "bg-sky-400 animate-pulse",
    orb: "from-sky-600/40 to-sky-900/40",
    anim: "animate-orb-speak",
  },
};

export default function VoiceRoom({ onDisconnect, onData }: Props) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const { state: agentState, audioTrack: agentAudio } = useVoiceAssistant();

  useEffect(() => {
    const handler = (payload: Uint8Array) => onData(payload);
    room.on(RoomEvent.DataReceived, handler);
    return () => { room.off(RoomEvent.DataReceived, handler); };
  }, [room, onData]);

  const toggleMic = useCallback(async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  const isConnected = connectionState === ConnectionState.Connected;
  const stateInfo = AGENT_STATES[agentState] ?? AGENT_STATES.disconnected;

  return (
    <div className="card flex flex-col gap-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stateInfo.dot}`} />
          <span className={`text-sm font-medium ${stateInfo.color}`}>
            {stateInfo.label}
          </span>
        </div>
        <button
          className="btn-danger flex items-center gap-1.5 text-xs"
          onClick={onDisconnect}
        >
          <PhoneOff size={13} />
          End Call
        </button>
      </div>

      {/* Orb + Visualizer */}
      <div className="flex flex-col items-center gap-4 py-3">
        <div className="relative flex items-center justify-center w-36 h-36">
          {/* Pulse rings - visible when speaking or listening */}
          {(agentState === "speaking" || agentState === "listening") && (
            <>
              <span className="absolute inset-0 rounded-full bg-current opacity-10 animate-ring-1"
                    style={{ color: agentState === "speaking" ? "#38bdf8" : "#34d399" }} />
              <span className="absolute inset-0 rounded-full bg-current opacity-10 animate-ring-2"
                    style={{ color: agentState === "speaking" ? "#38bdf8" : "#34d399" }} />
            </>
          )}

          {/* Orb */}
          <div className={`absolute inset-3 rounded-full bg-gradient-to-br ${stateInfo.orb}
                           border border-white/10 ${stateInfo.anim}
                           shadow-[0_0_30px_rgba(0,0,0,0.5)]`} />

          {/* Visualizer overlay */}
          <div className="relative z-10 w-24 h-10 flex items-center justify-center">
            {agentAudio ? (
              <BarVisualizer
                trackRef={agentAudio}
                barCount={20}
                className="w-full h-full"
              />
            ) : (
              <div className="flex gap-0.5 items-center">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-white/20 rounded-full"
                    style={{ height: `${6 + Math.sin(i * 0.8) * 5}px` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Connection state sub-label */}
        {connectionState !== ConnectionState.Connected && (
          <p className="text-xs text-slate-500">
            Room: {connectionState}
          </p>
        )}
      </div>

      {/* Mic button */}
      <div className="flex justify-center">
        <button
          onClick={toggleMic}
          disabled={!isConnected}
          className={`
            relative flex flex-col items-center gap-2 w-20 h-20 rounded-full border-2
            transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed
            ${isMicrophoneEnabled
              ? "bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_24px_rgba(239,68,68,0.3)]"
              : "bg-surface-hover border-surface-border text-slate-400 hover:border-brand/60 hover:text-brand-light hover:shadow-[0_0_20px_rgba(99,102,241,0.2)]"
            }
            active:scale-95
          `}
          aria-label={isMicrophoneEnabled ? "Mute" : "Unmute"}
        >
          {isMicrophoneEnabled && (
            <span className="absolute inset-0 rounded-full border-2 border-red-500/40 animate-ping" />
          )}
          {isMicrophoneEnabled ? <Mic size={26} /> : <MicOff size={26} />}
          <span className="text-[9px] font-semibold tracking-wide">
            {isMicrophoneEnabled ? "MUTE" : "SPEAK"}
          </span>
        </button>
      </div>
    </div>
  );
}
