# Wholesale Research Platform — Implementation Plan
**v3.0 · SerpApi + Tavily dual-source architecture**
> No vendor SDKs. SerpApi for product/trend data. Tavily for local retail + research. Dual-currency pricing.

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

This document supersedes v2.0. Key architectural changes from v2.0:

1. **No Alibaba engine** — SerpApi does not support an `alibaba` engine. Wholesale sourcing is handled by a wholesale-focused Google Shopping search (`google_shopping` engine with "wholesale bulk lot" query terms).
2. **Local retail via Tavily** — Tavily now serves a dual role: regulation/market research (unchanged) plus local retail price discovery for the user's target country. This gives local-market pricing that US-centric SerpApi engines cannot provide.
3. **Dual-currency pricing** — All prices are displayed in both USD and the user's local currency. Exchange rates are fetched once per session from a free API (open.er-api.com, no key needed).
4. **LLM-based price classification** — Instead of hardcoding `price_type` per platform, Claude classifies each listing as wholesale/retail/variable based on listing signals (title, price level, MOQ, seller type).

The system uses **6 data sources** for product sourcing: 5 SerpApi engines in parallel (wholesale Google Shopping, Amazon, eBay, Walmart, standard Google Shopping) plus 1 Tavily-powered local retail search. Google Trends uses 4 SerpApi calls. Regulation and market research use Tavily. Claude handles all LLM synthesis.

---

## 2. External API Summary

### 2.1 SerpApi — Product Sourcing + Trends

SerpApi provides structured product data from 4 retail platforms plus a wholesale-focused Google Shopping search, all under a single API key. It also handles Google Trends.

> **Note:** SerpApi does *not* have an Alibaba engine. Wholesale data comes from Google Shopping with wholesale-oriented query terms, which surfaces DHgate storefronts, bulk suppliers, and wholesale distributors.

| Source | Engine | Query Strategy | Data Purpose | Notes |
|---|---|---|---|---|
| Wholesale (Google Shopping) | `google_shopping` | `"{query} wholesale bulk lot"` | Wholesale floor price, bulk suppliers | Replaces non-existent Alibaba engine |
| Amazon | `amazon` | `k={query}` | Retail ceiling, brand landscape, reviews | Use `k` param (not `search_term`) |
| eBay | `ebay` | `_nkw={query}` | Secondary market, lot listings, used prices | Arbitrage signals |
| Walmart | `walmart` | `query={query}` | Mass retail baseline, US market | US consumer price floor |
| Google Shopping | `google_shopping` | `q={query}` | Cross-platform retail price index | Standard retail reference |

Trends calls use the same `SERPAPI_API_KEY` with `engine=google_trends` and four `data_type` values: `TIMESERIES`, `GEO_MAP`, `RELATED_QUERIES`, `RELATED_TOPICS`.

### 2.2 Tavily — Local Retail + Regulation + Market Research

Tavily serves three roles:

1. **Local retail pricing** (Phase 2) — 3 smart queries per search targeting the user's country (English + local language + comparison sites). Claude extracts structured product/price data from results. This provides the **local market baseline** that US-centric SerpApi engines cannot.
2. **Import regulation research** (Phase 4) — Targeted queries using HS codes and regulatory flags, biased toward `.gov` domains.
3. **Market landscape research** (Phase 5) — Competitor, channel, and positioning queries.

`search_depth=advanced` returns both an AI-generated answer and raw source URLs.

### 2.3 Exchange Rate API — Dual Currency

`open.er-api.com` provides free USD-to-local exchange rates with no API key. Called once per sourcing request. Used to:
- Convert SerpApi prices (USD) → local currency for display
- Convert Tavily local retail prices (local currency) → USD for comparison
- Output all summary prices (floor, ceiling, median) in both currencies

Falls back to USD-only when target country is US or API is unreachable.

### 2.4 Anthropic Claude — All LLM Work

Claude handles five distinct tasks:
1. **Keyword extraction** from raw user query
2. **Price classification** — classifies each product listing as wholesale/retail/variable based on listing signals (not hardcoded by platform)
3. **Price synthesis** across all 6 data sources with dual-currency output
4. **Local retail extraction** — parses Tavily web results into structured product/price data
5. **Trend/regulation/market report synthesis**

All Claude calls are server-side only — no API keys reach the browser.

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
│   ├── sourcing.router.ts     ← multi-platform product search + local retail
│   ├── trends.router.ts       ← google trends 4x data types
│   ├── regulations.router.ts  ← tavily regulation research
│   ├── market.router.ts       ← tavily market research
│   └── opportunity.router.ts  ← cross-signal fusion
├── services/
│   ├── serpapi.service.ts     ← SerpApi calls (5 sourcing engines + trends)
│   ├── tavily.service.ts      ← Tavily HTTP client (local retail + regulations + market)
│   ├── claude.service.ts      ← Anthropic SDK wrapper
│   └── geolocation.service.ts ← IP → country
└── lib/
    ├── keyword-extractor.ts   ← LLM extraction pipeline
    ├── price-synthesizer.ts   ← cross-platform price LLM logic (dual currency)
    ├── local-retail.ts        ← Tavily local retail search + Claude extraction
    ├── exchange-rate.ts       ← USD → local currency rate (open.er-api.com)
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
| 0.2 | Shared types package | Zod schemas: `SearchQuery`, `ProductMetadata` (includes `regulatory_flags[]`, `import_regulations[]`, `impositive_regulations[]`), `PlatformProduct`, `PriceAnalysis`, `TrendReport`, `RegulationReport`, `MarketReport`, `OpportunityReport` | BE | 0.1 |
| 0.3 | API scaffold | Fastify + tRPC, root router, context, health check `/ping` route | BE | 0.1 |
| 0.4 | Web scaffold | React + Vite, tRPC client, TanStack Query provider, shadcn init (default theme) | FE | 0.1 |
| 0.5 | `.env.example` | Document all variables — see Section 6. Only 4 API keys total | BE | 0.1 |

---

### Phase 1 — LLM Keyword Extraction + Geolocation

> The entry point for every session. Runs first. Its output feeds all downstream calls.

| # | Task | Description | Owner | Depends On |
|---|---|---|---|---|
| 1.1 | `claude.service.ts` | Anthropic SDK wrapper: `complete(system, user)` → typed JSON. Includes retry with exponential backoff. | BE | 0.3 |
| 1.2 | `keyword-extractor.ts` | Prompt: given `raw_query` + country, return `{ product_name, hs_code, category, regulatory_flags[], import_regulations[], impositive_regulations[], market_terms[], trend_keywords[], normalized_query }`. `regulatory_flags` = certifications (FCC, CE, RoHS). `import_regulations` = customs, permits, restrictions. `impositive_regulations` = tariffs, duties, VAT. Output parsed with Zod. | BE | 1.1 |
| 1.3 | `geolocation.service.ts` | `GET ip-api.com/json/{ip}` → `{ country_code, country_name, city }`. Falls back to manual country input if IP lookup fails. | BE | 0.3 |
| 1.4 | `search.router.ts` | tRPC procedure `search.initiate(raw_query)`: detects country, runs keyword extractor, persists session + `ProductMetadata`, returns both. | BE | 1.2, 1.3 |
| 1.5 | `SearchBar.tsx` | Input + submit. Shows detected country badge. On success, stores `productMetadata` in component state and enables all downstream query hooks. | FE | 0.4, 1.4 |
| 1.6 | `Research.tsx` metadata card | Displays `regulatory_flags`, `import_regulations`, `impositive_regulations` in separate sections alongside category, trend keywords, market terms. | FE | 0.4, 1.4 |

---

### Phase 2 — Multi-Platform Product Sourcing (SerpApi + Tavily + Dual Currency)

> 6 data sources fire in parallel: 5 SerpApi engines + 1 Tavily local retail search. Exchange rate fetched simultaneously. Claude classifies listings and synthesizes dual-currency price analysis.

| # | Task | Description | Owner | Depends On |
|---|---|---|---|---|
| 2.1 | `serpapi.service.ts` — sourcing | `searchPlatform(platform, query)` method. Handles `google_shopping_wholesale` (Google Shopping + "wholesale bulk lot" terms), `amazon` (param `k`), `ebay`, `walmart`, `google_shopping` engines. Maps raw responses to `PlatformProduct` schema. **No hardcoded `price_type`** — Claude classifies later. | BE | 0.3 |
| 2.2 | `tavily.service.ts` | Generic Tavily HTTP client: `search(query, options)` → `{ answer?, results[] }`. Supports `include_domains[]`, `search_depth`, `max_results`, `include_answer`. Reused by Phases 4–5. | BE | 0.3 |
| 2.3 | `exchange-rate.ts` | `getExchangeRate(countryCode)` → `{ currency_code, rate }`. Fetches from `open.er-api.com/v6/latest/USD` (free, no key). Maps country code → currency code via lookup table. Falls back to `{ "USD", 1 }`. | BE | 0.3 |
| 2.4 | `local-retail.ts` | `searchLocalRetail(query, countryCode, countryName, currencyCode)`: builds 3 smart Tavily queries (English, local language, comparison sites), runs in parallel, feeds combined results to Claude to extract structured `PlatformProduct[]` with `price_raw` (USD), `price_local` (local currency), seller name, URL. Products tagged `platform: "local_retail"`. | BE | 2.2, 1.1 |
| 2.5 | `price-synthesizer.ts` | Receives all 6 platform results + exchange rate. Claude prompt: (a) classifies each listing as wholesale/retail/variable from signals, (b) derives wholesale floor, retail ceiling, local retail median, (c) outputs all summary prices in **both USD and local currency**, (d) computes importable margin between wholesale floor and local retail median. | BE | 2.1, 2.4, 1.1 |
| 2.6 | `sourcing.router.ts` | tRPC procedure `sourcing.search(normalized_query, country_code, country_name)`: fetches exchange rate + 5 SerpApi platforms + Tavily local retail **all in parallel**. Stamps `price_local` on SerpApi products using rate. Runs price synthesis. Returns `{ platforms, price_analysis, local_currency_code, exchange_rate }`. | BE | 2.5 |
| 2.7 | `SourcingPanel.tsx` | Tab view: Summary + 6 platform tabs (Wholesale, Amazon, eBay, Walmart, Google Shopping, Local Retail). **Dual-currency display**: product cards show USD and local price side by side. Summary bar shows wholesale floor, retail ceiling, local retail median, margin range, best source — each in both currencies. Uses shadcn `Tabs`, `Card`, `Badge`. | FE | 0.4, 2.6 |

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

> 5–6 targeted Tavily queries built from `hs_code` + `regulatory_flags[]` + `import_regulations[]` + `impositive_regulations[]` + `country_code`. Biased toward `.gov` and customs authority domains.

| # | Task | Description | Owner | Depends On |
|---|---|---|---|---|
| 4.1 | `tavily.service.ts` | Already created in Phase 2.2. Reuse `search(query, options)` method. | BE | 2.2 |
| 4.2 | Regulation query builder | Builds 5 queries: HS tariff duty rate, required certifications, prohibited variants, labeling rules, licensing/quota. Uses `regulatory_flags`, `import_regulations`, `impositive_regulations` from ProductMetadata. Each targets `.gov` domains via `include_domains`. | BE | 4.1, 1.2 |
| 4.3 | Regulation LLM synthesis | Claude: parse all Tavily results into `RegulationReport` — `duty_rate_percent`, `required_certifications[]`, `prohibited_variants[]`, `labeling_requirements[]`, `sources[]`. Always includes disclaimer. | BE | 4.2, 1.1 |
| 4.4 | `regulations.router.ts` | tRPC procedure `regulations.research(hs_code, regulatory_flags[], import_regulations[], impositive_regulations[], country_code)`: returns `RegulationReport`. | BE | 4.3 |
| 4.5 | `RegulationCard.tsx` | Duty rate highlighted. Certification badges. Prohibited variants as `Alert` destructive. Source links with domain labels. Disclaimer at bottom. Uses shadcn `Card`, `Badge`, `Alert`. | FE | 0.4, 4.4 |

---

### Phase 5 — Market Research + Opportunity Fusion

> Tavily market queries run in parallel with Phases 2–4. Opportunity Fusion waits for all four modules to resolve before synthesizing.

| # | Task | Description | Owner | Depends On |
|---|---|---|---|---|
| 5.1 | Market query builder | Builds 5 queries from `market_terms[]` + `country_code`: top competitors, best e-commerce channels, consumer demand, product positioning. | BE | 2.2, 1.2 |
| 5.2 | Market LLM synthesis | Claude: produce `MarketReport` — `competition_level`, `top_competitors[]`, `top_channels[]`, `positioning_tip`, `summary`. | BE | 5.1, 1.1 |
| 5.3 | `market.router.ts` | tRPC procedure `market.research(market_terms[], country_code)`: returns `MarketReport`. | BE | 5.2 |
| 5.4 | `opportunity-scorer.ts` | Fuses `PriceAnalysis` + `TrendReport` + `RegulationReport` + `MarketReport` into `OpportunityReport` via Claude: `opportunity_score` 0–100, `estimated_margin_pct`, `best_source_platform`, `best_launch_month`, `keyword_gaps[]`, `variant_suggestions[]`, `risk_flags[]`. | BE | 2.2, 3.2, 4.3, 5.2 |
| 5.5 | `opportunity.router.ts` | tRPC procedure `opportunity.synthesize(sessionId)`: pulls all sub-reports, runs scorer, returns `OpportunityReport`. | BE | 5.4 |
| 5.6 | `MarketReport.tsx` | Competition intensity (`Progress`). Competitor list. Channels list. Positioning tip. Uses shadcn `Card`. | FE | 0.4, 5.3 |
| 5.7 | `OpportunityScore.tsx` | Large score 0–100. Best source platform badge. Margin % display. Launch month. Keyword gaps. Risk flags as `Alert`. Uses shadcn `Card`, `Alert`, `Badge`. | FE | 0.4, 5.5 |

---

## 6. Environment Variables

> Only 4 real API keys needed. `SERPAPI_API_KEY` covers all 5 sourcing engines and all 4 Trends data types. Exchange rate API is free and keyless.

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
| `SERPAPI_API_KEY` | `abc123def456...` | Single key — covers Amazon, eBay, Walmart, Google Shopping (×2 with wholesale terms), and Google Trends |
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

### Why Not Direct Alibaba API

SerpApi does **not** support an `alibaba` engine — this was an incorrect assumption in v2.0 that caused 400 errors at runtime. The Alibaba ICBU Open API requires ISV partner approval (weeks-long process), OAuth2, and MD5 request signing, making it impractical.

**Solution:** Wholesale pricing is sourced via Google Shopping with wholesale-oriented query terms (`"{query} wholesale bulk lot"`). This surfaces DHgate storefronts, wholesale distributors, and bulk suppliers that list on Google Shopping. Combined with LLM-based price classification (instead of hardcoding by platform), this provides effective wholesale vs retail price separation.

### Dual-Currency Architecture

All prices flow through in both USD and the user's local currency:

```
Exchange rate fetched once per request (open.er-api.com, free)
        │
        ├──→ SerpApi results (USD native)
        │    └── price_local = price_raw × rate
        │
        ├──→ Tavily local retail (local currency native)
        │    └── price_raw = price_local ÷ rate
        │
        └──→ Price synthesis outputs all summaries in both currencies
             └── Frontend displays: "$4.50 / CLP 4,200"
```

When target country is US, `rate = 1` and only USD is shown.

### Parallel Execution Strategy

After Phase 1 (keyword extraction) resolves, Phases 2–5 all fire simultaneously:

```
keyword extraction resolves
        │
        ├──→ sourcing.search()
        │    ├── exchange rate        (1 HTTP call)
        │    ├── 5 SerpApi platforms  (Promise.all — 5 engines)
        │    └── Tavily local retail  (3 queries + Claude extraction)
        │    └── price synthesis      (after all 6 sources resolve)
        │
        ├──→ trends.get()             (Promise.all — 4 data types)
        ├──→ regulations.research()   (Promise.all — 5 Tavily queries)
        └──→ market.research()        (Promise.all — 5 Tavily queries)
                    │
                    └──→ opportunity.synthesize()  (waits for all 4)
```

On the frontend, all four TanStack Query hooks are `enabled: !!productMetadata`. Opportunity synthesis uses a fifth hook enabled only when all four sub-reports have resolved.

### Credit Efficiency

Each user search consumes:
- **SerpApi**: 9 credits (5 sourcing + 4 trends). Developer tier ($75/month, 5,000 searches) supports ~555 sessions/month.
- **Tavily**: 8 credits (3 local retail + 5 regulation/market). Researcher tier (1,000 free/month) supports ~125 sessions/month.
- **Claude**: ~6 calls (extraction + classification + synthesis + trends + regulation + market).
- **Exchange rate**: 1 free call (no quota).

Cache aggressively:
- Trend data → valid for 24h
- Product listings → valid for 1h
- Regulation data → valid for 7 days
- Exchange rates → valid for 1h

### Regulation Accuracy Disclaimer

Every `RegulationCard` must render a visible disclaimer:

> *"This information is AI-generated from publicly available web sources and should be verified with a licensed customs broker before making import decisions."*

Source URLs must be displayed so users can cross-check against official government sites.

### Security — No Keys in Browser

`VITE_API_URL` is the only environment variable the React frontend receives. All `SERPAPI_API_KEY`, `TAVILY_API_KEY`, and `ANTHROPIC_API_KEY` values are server-side only and never appear in any client bundle, API response, or tRPC payload.