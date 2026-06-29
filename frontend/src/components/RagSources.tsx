import type { RagSource } from "../App";
import { BookOpen, Sparkles } from "lucide-react";

interface Props {
  sources: RagSource[];
}

export default function RagSources({ sources }: Props) {
  return (
    <div className="card flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen size={13} className="text-slate-500" />
        <h3 className="section-label flex-1">RAG Sources</h3>
        {sources.length > 0 && (
          <span className="flex items-center gap-1 badge bg-brand/15 text-brand-light border border-brand/25">
            <Sparkles size={9} />
            {sources.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2">
            <div className="w-9 h-9 rounded-full bg-surface-hover border border-surface-border
                            flex items-center justify-center">
              <BookOpen size={14} className="text-slate-600" />
            </div>
            <p className="text-slate-600 text-xs text-center">
              Retrieved chunks appear here
            </p>
          </div>
        ) : (
          sources.map((src, i) => (
            <div
              key={i}
              className="bg-surface rounded-xl border border-surface-border p-3 space-y-2
                         hover:border-brand/30 transition-colors duration-150 animate-fade-up"
            >
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-brand-light bg-brand/15
                                 border border-brand/25 rounded-md px-1.5 py-0.5 shrink-0">
                  #{i + 1}
                </span>
                <span className="text-xs font-medium text-slate-300 truncate" title={src.source}>
                  {src.source}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-4 border-l-2
                            border-brand/25 pl-2.5">
                {src.snippet}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
