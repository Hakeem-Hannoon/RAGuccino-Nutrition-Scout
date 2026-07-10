import fs from "node:fs";
import path from "node:path";

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadDotEnv(filePath = path.join(process.cwd(), ".env")) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = unquote(trimmed.slice(eq + 1));
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

export function readConfig() {
  loadDotEnv(path.join(process.cwd(), ".env.local"));
  loadDotEnv(path.join(process.cwd(), ".env"));
  const searchProvider = (process.env.SEARCH_PROVIDER || "tavily").toLowerCase();
  const port = Number(process.env.PORT || 8787);
  return {
    port: Number.isFinite(port) ? port : 8787,
    modelBaseUrl:
      process.env.MODEL_BASE_URL ||
      process.env.AZURE_FOUNDRY_ENDPOINT ||
      "https://api.openai.com/v1",
    modelApiKey: process.env.MODEL_API_KEY || process.env.AZURE_FOUNDRY_API_KEY || "",
    modelName: process.env.MODEL_NAME || process.env.AZURE_FOUNDRY_MODEL || "gpt-4.1-mini",
    modelAuthHeader: (process.env.MODEL_AUTH_HEADER || "authorization").toLowerCase(),
    searchProvider,
    tavilyApiKey: process.env.TAVILY_API_KEY || "",
    braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY || "",
    fdcApiKey: process.env.FDC_API_KEY || "",
    fetchPages: process.env.RAG_FETCH_PAGES !== "false",
    maxWebResults: Math.min(10, Math.max(1, Number(process.env.RAG_MAX_WEB_RESULTS || 5))),
    maxFetchedPages: Math.min(5, Math.max(0, Number(process.env.RAG_MAX_FETCHED_PAGES || 3))),
  };
}

export function describeConfig(config) {
  const searchConfigured =
    (config.searchProvider === "tavily" && Boolean(config.tavilyApiKey)) ||
    (config.searchProvider === "brave" && Boolean(config.braveSearchApiKey));
  return {
    ok: true,
    modelConfigured: Boolean(config.modelApiKey),
    searchConfigured,
    fdcConfigured: Boolean(config.fdcApiKey),
    searchProvider: config.searchProvider,
    modelName: config.modelName,
  };
}
