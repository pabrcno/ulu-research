# Wholesale Research Platform — Implementation Plan
**v2.0 · SerpApi-first architecture**
> No vendor SDKs. One API key for all product + trend data.

---

## Table of Contents
1. [Overview](#1-overview)
2. [External API Summary](#2-external-api-summary)
3. [Tech Stack](#3-tech-stack)
4. [Folder Structure](#4-folder-structure)
5. [Implementation Phases](#5-implementation-phases)
6. [Environment Variables](#6-environment-variables)
7. [Key Technical Notes](#7-key-technical-notes)

---

## 1. Overview

This document supersedes v1.0. The core architectural change is the removal of any direct Alibaba API integration. All product sourcing data — wholesale prices, retail reference prices, secondary market data — is fetched through SerpApi using its dedicated platform engines. This eliminates OAuth2 complexity, ISV approval requirements, and per-platform API keys.

The system uses SerpApi as the single external data source for both product pricing (5 platforms in parallel) and Google Trends (4 data types). Tavily covers regulation and market research. Claude handles all LLM synthesis. One `SERPAPI_API_KEY` covers everything on the sourcing and trends side.

---

## 2. External API Summary

### 2.1 SerpApi — Product Sourcing + Trends

SerpApi is the only product data provider. It covers 5 sourcing platforms plus 4 Google Trends data types, all under a single API key with a unified JSON response format.

| Platform | Engine | Data Purpose | Price Type | Notes |
|---|---|---|---|---|
| Alibaba | `alibaba` | Wholesale floor price, MOQ, suppliers | Bulk / unit | Primary sourcing source |
| Amazon | `amazon` | Retail ceiling, brand landscape, reviews | Retail each | Best retail reference |
| eBay | `ebay` | Secondary market, lot listings, used prices | Variable | Arbitrage signals |
| Walmart | `walmart` | Mass retail baseline, US market | Retail each | US consumer price floor |
| Google Shopping | `google_shopping` | Cross-platform price index, local availability | Mixed | Catches other retailers |

Trends calls use the same `SERPAPI_API_KEY` with `engine=google_trends` and four `data_type` values: `TIMESERIES`, `GEO_MAP`, `RELATED_QUERIES`, `RELATED_TOPICS`.

### 2.2 Tavily — Regulation + Market Research

Tavily handles all web research: import regulation scraping (targeting `.gov` and customs domains) and local market landscape research. `search_depth=advanced` returns both an AI-generated answer and raw source URLs, which Claude synthesizes into structured reports with citations.

### 2.3 Anthropic Claude — All LLM Work

Claude handles four distinct tasks: keyword extraction from raw user query, price synthesis across platforms, trend interpretation, and regulation/market report synthesis. All Claude calls are server-side only — no API keys reach the browser.

---

## 3. Tech Stack

### 3.1 Monorepo Structure

```
/
├── apps/
│   ├── api/          ← tRPC + Fastify backend (TypeScript)
│   └── web/          ← React + Vite frontend (TypeScript)
├── packages/
│   ├── types/        ← Shared Zod schemas + TypeScript types
│   └── config/       ← Shared ESLint, tsconfig
├── .env.example
└── turbo.json
```

### 3.2 Backend — `apps/api`

| Concern | Choice |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Framework | Fastify with `@trpc/server` adapter |
| API Layer | tRPC v11 — end-to-end type-safe procedures |
| Validation | Zod schemas shared with frontend via `packages/types` |
| HTTP Client | `node-fetch` for all SerpApi and Tavily calls |
| LLM | Anthropic SDK (`@anthropic-ai/sdk`) |

### 3.3 Frontend — `apps/web`

| Concern | Choice |
|---|---|
| Framework | React 18 + Vite |
| tRPC Client | `@trpc/react-query` + TanStack Query |
| UI | shadcn/ui — default theme, no custom styling |
| Charts | Recharts — timeseries line chart, regional bar chart |
| State | TanStack Query only — no Zustand or Redux |

---

## 4. Folder Structure

### 4.1 API (`apps/api/src/`)

```
src/
├── index.ts
├── router.ts                  ← root tRPC router
├── context.ts                 ← env + shared clients
├── routers/
│   ├── search.router.ts       ← keyword extraction + session init
│   ├── sourcing.router.ts     ← multi-platform product search
│   ├── trends.router.ts       ← google trends 4x data types
│   ├── regulations.router.ts  ← tavily regulation research
│   ├── market.router.ts       ← tavily market research
│   └── opportunity.router.ts  ← cross-signal fusion
├── services/
│   ├── serpapi.service.ts     ← ALL SerpApi calls (sourcing + trends)
│   ├── tavily.service.ts      ← ALL Tavily calls
│   ├── claude.service.ts      ← Anthropic SDK wrapper
│   └── geolocation.service.ts ← IP → country
└── lib/
    ├── keyword-extractor.ts   ← LLM extraction pipeline
    ├── price-synthesizer.ts   ← cross-platform price LLM logic
    └── opportunity-scorer.ts  ← final fusion logic
```

### 4.2 Frontend (`apps/web/src/`)

```
src/
├── main.tsx
├── App.tsx
├── trpc.ts
├── pages/
│   └── Research.tsx           ← single page app
├── components/
│   ├── SearchBar.tsx
│   ├── SourcingPanel.tsx      ← price comparison across platforms
│   ├── TrendsPanel.tsx
│   ├── RegulationCard.tsx
│   ├── MarketReport.tsx
│   └── OpportunityScore.tsx
└── lib/
    └── utils.ts               ← shadcn cn() helper
```

---

## 5. Implementation Phases

### Phase 0 — Monorepo Bootstrap

> Scaffold everything. No business logic.

| # | Task | Description | Owner | Depends On |
|---|---|---|---|---|
| 0.1 | Init Turborepo | `pnpm create turbo`, configure `turbo.json` pipelines for build/dev/lint/typecheck | BE | — |
| 0.2 | Shared types package | Zod schemas: `SearchQuery`, `ProductMetadata`, `PlatformProduct`, `PriceAnalysis`, `TrendReport`, `RegulationReport`, `MarketReport`, `OpportunityReport` | BE | 0.1 |
| 0.3 | API scaffold | Fastify + tRPC, root router, context, health check `/ping` route | BE | 0.1 |
| 0.4 | Web scaffold | React + Vite, tRPC client, TanStack Query provider, shadcn init (default theme) | FE | 0.1 |
| 0.5 | `.env.example` | Document all variables — see Section 6. Only 4 API keys total | BE | 0.1 |

---

### Phase 1 — LLM Keyword Extraction + Geolocation

> The entry point for every session. Runs first. Its output feeds all downstream calls.

| # | Task | Description | Owner | Depends On |
|---|---|---|---|---|
| 1.1 | `claude.service.ts` | Anthropic SDK wrapper: `complete(system, user)` → typed JSON. Includes retry with exponential backoff. | BE | 0.3 |
| 1.2 | `keyword-extractor.ts` | Prompt: given `raw_query` + country, return `{ product_name, hs_code, category, regulatory_flags[], market_terms[], trend_keywords[], normalized_query }`. Output parsed with Zod. | BE | 1.1 |
| 1.3 | `geolocation.service.ts` | `GET ip-api.com/json/{ip}` → `{ country_code, country_name, city }`. Falls back to manual country input if IP lookup fails. | BE | 0.3 |
| 1.4 | `search.router.ts` | tRPC procedure `search.initiate(raw_query)`: detects country, runs keyword extractor, persists session + `ProductMetadata`, returns both. | BE | 1.2, 1.3 |
| 1.5 | `SearchBar.tsx` | Input + submit. Shows detected country badge. On success, stores `productMetadata` in component state and enables all downstream query hooks. | FE | 0.4, 1.4 |

---

### Phase 2 — Multi-Platform Product Sourcing (SerpApi)

> Five SerpApi engines fire in parallel via `Promise.all()`. Claude synthesizes across all five into a `PriceAnalysis`.

| # | Task | Description | Owner | Depends On |
|---|---|---|---|---|
| 2.1 | `serpapi.service.ts` — sourcing | `searchPlatform(engine, query, domain?)` method. Handles `alibaba`, `amazon`, `ebay`, `walmart`, `google_shopping` engines. Maps raw response to `PlatformProduct` schema. | BE | 0.3 |
| 2.2 | `price-synthesizer.ts` | Feeds all 5 platform results to Claude: identify wholesale floor (Alibaba), retail ceiling (Amazon/Walmart), gross margin range, best source platform, arbitrage signals. | BE | 2.1, 1.1 |
| 2.3 | `sourcing.router.ts` | tRPC procedure `sourcing.search(normalized_query)`: runs 5 platform searches in parallel, runs price synthesis, returns `{ platforms: PlatformProduct[][], priceAnalysis: PriceAnalysis }`. | BE | 2.2 |
| 2.4 | `SourcingPanel.tsx` | Tab view per platform. Each tab shows product cards with title, price, rating, link. Summary bar shows wholesale floor vs retail ceiling and margin range. Uses shadcn `Tabs`, `Card`, `Badge`. | FE | 0.4, 2.3 |

---

### Phase 3 — Google Trends (SerpApi)

> Four `google_trends` calls in parallel using the same `SERPAPI_API_KEY`.

| # | Task | Description | Owner | Depends On |
|---|---|---|---|---|
| 3.1 | `serpapi.service.ts` — trends | `getTrends(keyword, geo)`: fires 4 parallel calls with `data_type`: `TIMESERIES`, `GEO_MAP`, `RELATED_QUERIES`, `RELATED_TOPICS`. Returns all 4 raw payloads. | BE | 0.3 |
| 3.2 | Trend LLM synthesis | Claude prompt: interpret 4 raw payloads into `TrendReport` — direction, peak_month, is_seasonal, trend_score 0–100, rising queries, regional hotspots. | BE | 3.1, 1.1 |
| 3.3 | `trends.router.ts` | tRPC procedure `trends.get(trend_keywords[], geo)`: returns `TrendReport`. | BE | 3.2 |
| 3.4 | `TrendsPanel.tsx` | Recharts `LineChart` for weekly timeseries. `BarChart` for top regions. Rising queries list. Direction badge. Uses shadcn `Card`. | FE | 0.4, 3.3 |

---

### Phase 4 — Import Regulation Research (Tavily)

> 5–6 targeted Tavily queries built from `hs_code` + `regulatory_flags[]` + `country_code`. Biased toward `.gov` and customs authority domains.

| # | Task | Description | Owner | Depends On |
|---|---|---|---|---|
| 4.1 | `tavily.service.ts` | `search(queries[], options)` method. Supports `include_domains[]`, `search_depth`, `include_answer`. Returns `TavilyResult[][]`. | BE | 0.3 |
| 4.2 | Regulation query builder | Builds 5 queries: HS tariff duty rate, required certifications, prohibited variants, labeling rules, licensing/quota. Each targets `.gov` domains via `include_domains`. | BE | 4.1, 1.2 |
| 4.3 | Regulation LLM synthesis | Claude: parse all Tavily results into `RegulationReport` — `duty_rate_percent`, `required_certifications[]`, `prohibited_variants[]`, `labeling_requirements[]`, `sources[]`. Always includes disclaimer. | BE | 4.2, 1.1 |
| 4.4 | `regulations.router.ts` | tRPC procedure `regulations.research(hs_code, regulatory_flags[], country_code)`: returns `RegulationReport`. | BE | 4.3 |
| 4.5 | `RegulationCard.tsx` | Duty rate highlighted. Certification badges. Prohibited variants as `Alert` destructive. Source links with domain labels. Disclaimer at bottom. Uses shadcn `Card`, `Badge`, `Alert`. | FE | 0.4, 4.4 |

---

### Phase 5 — Market Research + Opportunity Fusion

> Tavily market queries run in parallel with Phases 2–4. Opportunity Fusion waits for all four modules to resolve before synthesizing.

| # | Task | Description | Owner | Depends On |
|---|---|---|---|---|
| 5.1 | Market query builder | Builds 5 queries from `market_terms[]` + `country_code`: local retail prices, top competitors, best e-commerce channels, consumer demand, product positioning. | BE | 4.1, 1.2 |
| 5.2 | Market LLM synthesis | Claude: produce `MarketReport` — `competition_level`, `top_competitors[]`, `top_channels[]`, `positioning_tip`, `summary`. | BE | 5.1, 1.1 |
| 5.3 | `market.router.ts` | tRPC procedure `market.research(market_terms[], country_code)`: returns `MarketReport`. | BE | 5.2 |
| 5.4 | `opportunity-scorer.ts` | Fuses `PriceAnalysis` + `TrendReport` + `RegulationReport` + `MarketReport` into `OpportunityReport` via Claude: `opportunity_score` 0–100, `estimated_margin_pct`, `best_source_platform`, `best_launch_month`, `keyword_gaps[]`, `variant_suggestions[]`, `risk_flags[]`. | BE | 2.2, 3.2, 4.3, 5.2 |
| 5.5 | `opportunity.router.ts` | tRPC procedure `opportunity.synthesize(sessionId)`: pulls all sub-reports, runs scorer, returns `OpportunityReport`. | BE | 5.4 |
| 5.6 | `MarketReport.tsx` | Competition intensity (`Progress`). Competitor list. Channels list. Positioning tip. Uses shadcn `Card`. | FE | 0.4, 5.3 |
| 5.7 | `OpportunityScore.tsx` | Large score 0–100. Best source platform badge. Margin % display. Launch month. Keyword gaps. Risk flags as `Alert`. Uses shadcn `Card`, `Alert`, `Badge`. | FE | 0.4, 5.5 |

---

## 6. Environment Variables

> Only 4 real API keys needed. `SERPAPI_API_KEY` covers all 5 platform engines and all 4 Trends data types. No Alibaba key, no per-platform tokens.

### `apps/api/.env`

#### Anthropic

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-opus-4-5
```

| Variable | Example | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | From console.anthropic.com |
| `ANTHROPIC_MODEL` | `claude-opus-4-5` | Model for extraction and synthesis |

#### SerpApi — Sourcing + Trends

```env
SERPAPI_API_KEY=abc123def456...
SERPAPI_BASE_URL=https://serpapi.com/search.json
SERPAPI_RESULTS_PER_PAGE=10
SERPAPI_TRENDS_DATE=today 12-m
```

| Variable | Example | Description |
|---|---|---|
| `SERPAPI_API_KEY` | `abc123def456...` | Single key — covers Alibaba, Amazon, eBay, Walmart, Google Shopping, and Google Trends |
| `SERPAPI_BASE_URL` | `https://serpapi.com/search.json` | Unified endpoint for all engines |
| `SERPAPI_RESULTS_PER_PAGE` | `10` | Products per platform per search |
| `SERPAPI_TRENDS_DATE` | `today 12-m` | Date range for Trends TIMESERIES calls |

#### Tavily — Research

```env
TAVILY_API_KEY=tvly-xxxxxxxxxxxx
TAVILY_SEARCH_DEPTH=advanced
TAVILY_MAX_RESULTS=5
TAVILY_INCLUDE_ANSWER=true
```

| Variable | Example | Description |
|---|---|---|
| `TAVILY_API_KEY` | `tvly-xxxxxxxxxxxx` | From app.tavily.com |
| `TAVILY_SEARCH_DEPTH` | `advanced` | Use advanced for LLM-grade results |
| `TAVILY_MAX_RESULTS` | `5` | Results per query |
| `TAVILY_INCLUDE_ANSWER` | `true` | AI summary alongside raw sources |

#### Server — General

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
GEOLOCATION_API_URL=http://ip-api.com/json
```

| Variable | Example | Description |
|---|---|---|
| `PORT` | `3001` | Fastify server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin for CORS |
| `GEOLOCATION_API_URL` | `http://ip-api.com/json` | Free IP geolocation — no key needed |

### `apps/web/.env`

```env
VITE_API_URL=http://localhost:3001
```

| Variable | Example | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | tRPC API base URL. **Only env var the browser sees — no secrets.** |

---

## 7. Key Technical Notes

### Why SerpApi Instead of Direct Alibaba API

The Alibaba ICBU Open API requires ISV partner approval (weeks-long process), OAuth2 user-level token management, MD5 request signing, and separate `app_key` + `app_secret` per environment. SerpApi's `alibaba` engine provides equivalent product listing data — title, price, MOQ, supplier, rating — with a single HTTP GET and no approval process. The same key also covers Amazon, eBay, Walmart, Google Shopping, and Google Trends, making it the only product/trend credential in the system.

### Parallel Execution Strategy

After Phase 1 (keyword extraction) resolves, Phases 2–5 all fire simultaneously:

```
keyword extraction resolves
        │
        ├──→ sourcing.search()      (Promise.all — 5 platforms)
        ├──→ trends.get()           (Promise.all — 4 data types)
        ├──→ regulations.research() (Promise.all — 5 Tavily queries)
        └──→ market.research()      (Promise.all — 5 Tavily queries)
                    │
                    └──→ opportunity.synthesize()  (waits for all 4)
```

On the frontend, all four TanStack Query hooks are `enabled: !!productMetadata`. Opportunity synthesis uses a fifth hook enabled only when all four sub-reports have resolved.

### SerpApi Credit Efficiency

Each user search consumes a maximum of **9 SerpApi credits**: 5 for platform sourcing + 4 for Trends. At SerpApi's Developer tier ($75/month, 5,000 searches), this supports ~555 full research sessions per month.

Cache aggressively:
- Trend data → valid for 24h
- Product listings → valid for 1h
- Regulation data → valid for 7 days

### Regulation Accuracy Disclaimer

Every `RegulationCard` must render a visible disclaimer:

> *"This information is AI-generated from publicly available web sources and should be verified with a licensed customs broker before making import decisions."*

Source URLs must be displayed so users can cross-check against official government sites.

### Security — No Keys in Browser

`VITE_API_URL` is the only environment variable the React frontend receives. All `SERPAPI_API_KEY`, `TAVILY_API_KEY`, and `ANTHROPIC_API_KEY` values are server-side only and never appear in any client bundle, API response, or tRPC payload.