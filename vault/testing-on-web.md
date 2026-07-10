---
title: Testing On Web
tags: [web, testing]
status: current
updated: 2026-07-10
---

# Testing On Web

## Setup

```bash
cd ~/Developer/RAGuccino-Nutrition-Scout
npm install
```

Use `.env.local` for local secrets. It is ignored by git. Set:

```text
EXPO_PUBLIC_RAG_API_URL=http://localhost:8787
```

Start the API:

```bash
npm run server
```

Start Expo Web:

```bash
npm run web
```

Open the URL printed by Expo, usually `http://localhost:8081`.

## Smoke Prompts

- `What are the nutrition facts for Starbucks summer drinks?`
- `How many calories are in a grande iced pistachio latte?`
- `What is creatine used for?`
- `Log 2 cups cooked white rice and 6 oz grilled chicken.`

## Expected Result

- The health pill shows model and search configuration.
- Answers include citation cards.
- Citation taps open source pages.
- If the API URL is wrong, the app explains the local server fix.
