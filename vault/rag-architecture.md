---
title: RAG Architecture
tags: [architecture, rag]
status: current
updated: 2026-07-10
---

# RAG Architecture

```text
Browser / Expo Web chat UI
  |
  | POST /api/chat
  v
Local Node RAG API
  |
  +-- query text
  +-- Tavily or Brave web search
  +-- optional USDA FoodData Central lookup
  +-- safe page fetch + snippet extraction
  +-- citation list
  +-- OpenAI-compatible model call
  |
  v
Answer + citations back to browser
```

## Responsibilities

Mobile:

- collects user messages;
- shows setup status from `/health`;
- sends chat history to the API;
- renders answers and citation cards.

Server:

- loads `.env`;
- checks model/search/FDC configuration;
- runs web search only when the app toggle allows it;
- fetches public pages server-side;
- blocks private hosts;
- extracts snippets;
- calls the model with retrieved context;
- returns citations as structured data.

## Source Priority

For nutrition:

1. USDA FoodData Central structured data when `FDC_API_KEY` is set.
2. Official product/restaurant pages from web search.
3. Other cited public pages with clear serving information.

For general questions:

1. Search results.
2. Fetched page snippets.
3. Model answer grounded in those snippets.
