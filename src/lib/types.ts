export type Role = "user" | "assistant";

export type Citation = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source?: string;
};

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
  retrievalSummary?: string;
};

export type ChatResponse = {
  answer: string;
  citations: Citation[];
  retrieval: {
    query: string;
    provider: string;
    searched: boolean;
    fetchedPages: number;
    fdcMatches: number;
  };
};

export type HealthResponse = {
  ok: boolean;
  modelConfigured: boolean;
  searchConfigured: boolean;
  fdcConfigured: boolean;
  searchProvider: string;
  modelName: string;
};

