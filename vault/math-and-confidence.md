---
title: Math And Confidence
tags: [math, nutrition, retrieval]
status: current
updated: 2026-07-10
---

# Math And Confidence

## Atwater Calories

```text
kcal_atwater = protein_g * 4 + carbs_g * 4 + fat_g * 9
```

This is used as a consistency check against label calories.

## Label Delta

```text
delta_percent = abs(label_kcal - kcal_atwater) / label_kcal * 100
```

Large deltas suggest a serving mismatch, rounded label values, or weak source data.

## Portion Scaling

Per 100 g:

```text
scaled_value = nutrient_per_100g * consumed_grams / 100
```

Per serving:

```text
scaled_value = nutrient_per_serving * servings_consumed
```

## Retrieval Score

The first implementation uses lexical term coverage:

```text
score = matched_query_terms / total_query_terms
```

This is transparent and easy to debug on a resume demo. The production path can add
embeddings and reranking after eval cases exist.

## Confidence

```text
confidence = clamp(
  base
  + source_authority * 0.25
  + serving_clarity * 0.20
  + agreement * 0.20,
  0,
  1
)
```

Inputs:

- `source_authority`: USDA and official product pages rank higher.
- `serving_clarity`: explicit grams/serving/container ranks higher.
- `agreement`: label calories close to Atwater calories ranks higher.
- `base`: exact matches start higher.

