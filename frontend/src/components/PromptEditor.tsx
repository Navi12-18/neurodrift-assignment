import { useState, useEffect, useCallback } from "react";
import { Save, RotateCcw, Terminal } from "lucide-react";
import { api } from "../lib/api";

const DEFAULT = `You are a helpful voice assistant. Your responses will be spoken aloud, so keep them concise and natural — avoid bullet lists, markdown, or long explanations unless asked. When document context is provided, read it carefully and use the exact figures, names, and details from it to answer the user's question.`;
const MAX_CHARS = 1000;

export default function PromptEditor() {
  const [prompt, setPrompt] = useState(DEFAULT);
  const [saved, setSaved] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    api.getPrompt()
      .then((p) => { setPrompt(p); setSaved(true); })
      .catch(() => { /* server not ready */ });
  }, []);

  const handleChange = useCallback((val: string) => {
    setPrompt(val);
    setSaved(false);
    setStatus("idle");
  }, []);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setStatus("saving");
    try {
      await api.setPrompt(prompt);
      setSaved(true);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, [prompt]);

  const handleReset = useCallback(() => {
    setPrompt(DEFAULT);
    setSaved(false);
    setStatus("idle");
  }, []);

  const pct = Math.min((prompt.length / MAX_CHARS) * 100, 100);
  const charColor = pct > 90 ? "text-red-400" : pct > 70 ? "text-amber-400" : "text-slate-500";

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Terminal size={13} className="text-slate-500" />
        <h3 className="section-label flex-1">System Prompt</h3>
        <div className="flex items-center gap-1.5">
          {!saved && (
            <span className="text-[10px] text-amber-400 font-medium">● unsaved</span>
          )}
          <button
            className="btn-ghost p-1.5 rounded-lg"
            onClick={handleReset}
            title="Reset to default"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      <textarea
        className="input resize-none text-xs leading-relaxed font-mono"
        rows={7}
        value={prompt}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Enter a system prompt for the AI agent…"
        spellCheck={false}
        maxLength={MAX_CHARS}
      />

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Mini progress bar */}
          <div className="flex-1 h-0.5 bg-surface-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300
                ${pct > 90 ? "bg-red-400" : pct > 70 ? "bg-amber-400" : "bg-brand/50"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-[10px] shrink-0 ${charColor}`}>
            {prompt.length}/{MAX_CHARS}
          </span>
        </div>

        <button
          className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3 shrink-0"
          onClick={handleSave}
          disabled={loading || saved}
        >
          <Save size={12} />
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save"}
        </button>
      </div>

      {status === "error" && (
        <p className="text-xs text-red-400 animate-fade-up">
          Failed to save. Is the API server running?
        </p>
      )}
    </div>
  );
}
