import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Trash2, FileText, Loader2, AlertCircle, Database } from "lucide-react";
import { api, type KBDocument } from "../lib/api";

const ACCEPTED = ".pdf,.txt,.md,.docx";

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    try {
      setDocs(await api.listDocuments());
    } catch { /* server may not be ready */ }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const uploadFile = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await api.uploadDocument(file);
      await fetchDocs();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [fetchDocs]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      await api.deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  }, []);

  return (
    <div className="card flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Database size={13} className="text-brand-light" />
        <h3 className="section-label flex-1">Knowledge Base</h3>
        {docs.length > 0 && (
          <span className="badge bg-brand/15 text-brand-light border border-brand/25">
            {docs.length} {docs.length === 1 ? "doc" : "docs"}
          </span>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200
          cursor-pointer select-none
          ${dragOver
            ? "border-brand bg-brand/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
            : "border-surface-border hover:border-brand/40 hover:bg-surface-hover"
          }
        `}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        aria-label="Upload a document"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleFileInput}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-brand/15 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-brand-light" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-light">Processing…</p>
              <p className="text-xs text-slate-500 mt-0.5">Chunking & embedding</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors
                            ${dragOver ? "bg-brand/25" : "bg-surface-hover"}`}>
              <Upload size={18} className={dragOver ? "text-brand-light" : "text-slate-400"} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">
                {dragOver ? "Drop to upload" : "Drop file or click"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">PDF · DOCX · TXT · MD</p>
            </div>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/8
                        border border-red-500/20 rounded-xl px-3 py-2.5 animate-fade-up">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Document list */}
      <div className="space-y-1.5 overflow-y-auto max-h-64">
        {docs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-600 text-xs">No documents yet</p>
            <p className="text-slate-700 text-xs mt-0.5">Upload one to enable RAG</p>
          </div>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-2.5 bg-surface rounded-xl border
                         border-surface-border px-3 py-2.5 hover:border-brand/30
                         hover:bg-surface-hover transition-all duration-150 animate-fade-up"
            >
              <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20
                              flex items-center justify-center shrink-0">
                <FileText size={13} className="text-brand-light" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate" title={doc.filename}>
                  {doc.filename}
                </p>
                <p className="text-[10px] text-slate-600">{doc.chunk_count} chunks</p>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400
                           transition-all duration-150 p-1 rounded-lg hover:bg-red-500/10
                           disabled:opacity-40 shrink-0"
                onClick={() => handleDelete(doc.id)}
                disabled={deleting === doc.id}
                aria-label={`Delete ${doc.filename}`}
              >
                {deleting === doc.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Trash2 size={13} />
                }
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
