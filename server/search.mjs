import { atwaterKcal, confidenceScore, kcalDeltaRatio, round1 } from "./nutritionMath.mjs";

const USER_AGENT =
  "RAGuccinoNutritionScout/0.1 (local demo; nutrition retrieval and citation testing)";

const FDC_NUTRIENTS = {
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  energyKcal: 1008,
  fiber: 1079,
  sugar: 2000,
  sodium: 1093,
};

function terms(query) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2);
}

function scoreText(text, query) {
  const haystack = text.toLowerCase();
  const queryTerms = terms(query);
  if (!queryTerms.length) return 0;
  let score = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) score += 1;
  }
  return score / queryTerms.length;
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0"
  ) {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  return false;
}

function safeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (isPrivateHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|h1|h2|h3|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function bestSnippet(text, query) {
  const chunks = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 60)
    .slice(0, 140);
  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreText(chunk, query) }))
    .sort((a, b) => b.score - a.score);
  return (ranked[0]?.chunk || text.slice(0, 360)).slice(0, 520);
}

function isNutritionQuery(query) {
  return /\b(calorie|calories|kcal|macro|macros|protein|carb|carbs|fat|fiber|sugar|sodium|nutrition|nutrient|drink|latte|starbucks|food|meal|serving)\b/i.test(
    query,
  );
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchTavily(query, config) {
  if (!config.tavilyApiKey) return [];
  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: config.tavilyApiKey,
      query,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
      max_results: config.maxWebResults,
    }),
  });
  if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((item, index) => ({
    id: `w${index + 1}`,
    title: item.title || item.url || "Untitled result",
    url: item.url,
    snippet: item.content || "",
    source: "tavily",
    score: typeof item.score === "number" ? item.score : scoreText(item.content || "", query),
  }));
}

async function searchBrave(query, config) {
  if (!config.braveSearchApiKey) return [];
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(config.maxWebResults));
  const res = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": config.braveSearchApiKey,
    },
  });
  if (!res.ok) throw new Error(`Brave search failed: ${res.status}`);
  const data = await res.json();
  return (data.web?.results || []).map((item, index) => ({
    id: `w${index + 1}`,
    title: item.title || item.url || "Untitled result",
    url: item.url,
    snippet: item.description || "",
    source: "brave",
    score: scoreText(`${item.title || ""} ${item.description || ""}`, query),
  }));
}

async function searchWeb(query, config, enabled) {
  if (!enabled) return [];
  if (config.searchProvider === "brave") return searchBrave(query, config);
  return searchTavily(query, config);
}

async function fetchPage(result, query) {
  const url = safeUrl(result.url);
  if (!url) return null;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "text/html, text/plain;q=0.9, */*;q=0.2",
        "User-Agent": USER_AGENT,
      },
    },
    7000,
  );
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;
  const raw = await res.text();
  const text = contentType.includes("text/html") ? htmlToText(raw) : raw.replace(/\s+/g, " ");
  if (!text || text.length < 80) return null;
  return {
    ...result,
    snippet: bestSnippet(text.slice(0, 60000), query),
    fetched: true,
    score: Math.max(result.score || 0, scoreText(text.slice(0, 8000), query)),
  };
}

function nutrientValue(nutrients, id) {
  const found = nutrients?.find((item) => {
    const nutrientId = item.nutrientId ?? item.nutrient?.id;
    return nutrientId === id;
  });
  const value = found?.value ?? found?.amount;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function mapFdcFood(food, index) {
  const nutrients = food.foodNutrients || [];
  const proteinG = round1(nutrientValue(nutrients, FDC_NUTRIENTS.protein));
  const carbsG = round1(nutrientValue(nutrients, FDC_NUTRIENTS.carbs));
  const fatG = round1(nutrientValue(nutrients, FDC_NUTRIENTS.fat));
  const calories = nutrientValue(nutrients, FDC_NUTRIENTS.energyKcal);
  const macros = { proteinG, carbsG, fatG };
  const labelKcal = calories > 0 ? Math.round(calories) : Math.round(atwaterKcal(macros));
  const delta = kcalDeltaRatio(labelKcal, macros);
  const serving = food.householdServingFullText || `${food.servingSize || 100} ${food.servingSizeUnit || "g"}`;
  const brand = food.brandOwner || food.brandName || "";
  const confidence = confidenceScore({
    sourceAuthority: food.dataType === "Foundation" ? 0.95 : 0.8,
    servingClarity: serving ? 0.85 : 0.55,
    agreement: delta == null ? 0.6 : Math.max(0.25, 1 - delta / 30),
    exactMatch: index === 0,
  });
  return {
    id: `f${index + 1}`,
    title: `${food.description || "FoodData Central item"}${brand ? ` · ${brand}` : ""}`,
    url: food.fdcId ? `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients` : "https://fdc.nal.usda.gov/",
    source: "USDA FoodData Central",
    score: confidence,
    snippet: `${serving}. Protein ${proteinG}g, carbs ${carbsG}g, fat ${fatG}g, calories ${labelKcal}. Atwater check ${atwaterKcal(macros)} kcal${
      delta == null ? "" : `, ${delta}% delta`
    }.`,
  };
}

async function searchFdc(query, config) {
  if (!config.fdcApiKey || !isNutritionQuery(query)) return [];
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", config.fdcApiKey);
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: query.slice(0, 120),
      pageSize: 5,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"],
      sortBy: "dataType.keyword",
      sortOrder: "asc",
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.foods || []).map(mapFdcFood);
}

function rankAndDedupe(results) {
  const seen = new Set();
  const unique = [];
  for (const result of results) {
    if (!result.url || seen.has(result.url)) continue;
    seen.add(result.url);
    unique.push(result);
  }
  return unique.sort((a, b) => (b.score || 0) - (a.score || 0));
}

export async function retrieveContext({ question, webSearchEnabled, config }) {
  const [webResultsRaw, fdcResults] = await Promise.all([
    searchWeb(question, config, webSearchEnabled).catch((error) => [
      {
        id: "search_error",
        title: "Search provider error",
        url: "about:blank",
        snippet: error instanceof Error ? error.message : "Search failed.",
        source: config.searchProvider,
        score: 0,
      },
    ]),
    searchFdc(question, config).catch(() => []),
  ]);

  const webResults = webResultsRaw.filter((item) => item.url && item.url !== "about:blank");
  const fetchedPages = [];
  if (config.fetchPages && webSearchEnabled) {
    for (const result of webResults.slice(0, config.maxFetchedPages)) {
      const fetched = await fetchPage(result, question).catch(() => null);
      if (fetched) fetchedPages.push(fetched);
    }
  }

  const citations = rankAndDedupe([...fdcResults, ...fetchedPages, ...webResults])
    .slice(0, 8)
    .map((result, index) => ({
      id: `c${index + 1}`,
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      source: result.source,
    }));

  const context = citations
    .map((citation) => `[${citation.id}] ${citation.title}\nURL: ${citation.url}\n${citation.snippet}`)
    .join("\n\n");

  return {
    context,
    citations,
    retrieval: {
      query: question,
      provider: webSearchEnabled ? config.searchProvider : "web-disabled",
      searched: webSearchEnabled,
      fetchedPages: fetchedPages.length,
      fdcMatches: fdcResults.length,
    },
  };
}

