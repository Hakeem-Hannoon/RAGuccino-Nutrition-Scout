---
title: RAGuccino Vault Home
tags: [moc]
status: current
updated: 2026-07-10
---

# RAGuccino Nutrition Scout

RAGuccino is a standalone RAG app for nutrition retrieval and cited web answers. It is
designed to prove the retrieval layer Spotter needs for foods, drinks, and public
nutrition questions that change faster than static model knowledge.

Spotter website: https://www.spotter-labs.com

## Start Here

1. [[rag-architecture]] — how the web app, local server, retrieval layer, and model fit.
2. [[math-and-confidence]] — Atwater calories, serving scaling, retrieval scoring, confidence.
3. [[testing-on-web]] — exact local test path for Expo Web.
4. [[spotter-production-problem]] — how this maps back to Spotter.

## Core Idea

The web app is only a chat surface. The RAG API owns internet access, citations,
nutrition lookups, and model calls. That keeps secrets out of the browser and mirrors how
Spotter should consume retrieval in production.
