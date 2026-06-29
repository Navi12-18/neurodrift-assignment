const BASE = import.meta.env.VITE_API_URL ?? "";

export interface TokenResponse {
  token: string;
  url: string;
  room_name: string;
}

export interface KBDocument {
  id: string;
  filename: string;
  chunk_count: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((body as { detail?: string }).detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  async getToken(roomName: string, identity = "user"): Promise<TokenResponse> {
    return request("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_name: roomName, identity }),
    });
  },

  async getPrompt(): Promise<string> {
    const data = await request<{ prompt: string }>("/api/prompt");
    return data.prompt;
  },

  async setPrompt(prompt: string): Promise<void> {
    await request("/api/prompt", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
  },

  async listDocuments(): Promise<KBDocument[]> {
    const data = await request<{ documents: KBDocument[] }>("/api/kb/documents");
    return data.documents;
  },

  async uploadDocument(file: File): Promise<KBDocument> {
    const form = new FormData();
    form.append("file", file);
    return request<KBDocument>("/api/kb/upload", { method: "POST", body: form });
  },

  async deleteDocument(id: string): Promise<void> {
    await request(`/api/kb/documents/${id}`, { method: "DELETE" });
  },
};
