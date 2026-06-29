import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "../App";
import { MessageSquare } from "lucide-react";

interface Props {
  entries: TranscriptEntry[];
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function Transcript({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="card flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={13} className="text-slate-500" />
        <h3 className="section-label flex-1">Live Transcript</h3>
        {entries.length > 0 && (
          <span className="text-[10px] text-slate-600">{entries.length} messages</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="w-10 h-10 rounded-full bg-surface-hover border border-surface-border
                            flex items-center justify-center">
              <MessageSquare size={16} className="text-slate-600" />
            </div>
            <p className="text-slate-600 text-xs text-center">
              Conversation will appear here
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`flex gap-2.5 animate-fade-up ${
                entry.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px]
                             font-bold shrink-0 mt-0.5 border
                  ${entry.role === "user"
                    ? "bg-brand/20 border-brand/30 text-brand-light"
                    : "bg-surface-hover border-surface-border text-slate-400"
                  }`}
              >
                {entry.role === "user" ? "U" : "AI"}
              </div>

              {/* Bubble */}
              <div className={`flex flex-col gap-1 max-w-[82%] ${
                entry.role === "user" ? "items-end" : "items-start"
              }`}>
                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl
                    ${entry.role === "user"
                      ? "bg-brand/20 text-slate-100 rounded-tr-sm border border-brand/25"
                      : "bg-surface-hover text-slate-200 rounded-tl-sm border border-surface-border"
                    }`}
                >
                  {entry.text}
                </div>
                <span className="text-[10px] text-slate-600 px-1">
                  {formatTime(entry.ts)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
