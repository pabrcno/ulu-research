import { z } from "zod";
import type { PlatformProduct } from "@repo/types";
import { tavilySearch, type TavilyResult } from "../services/tavily.service.js";
import { searchGoogleShoppingLocal } from "../services/serpapi.service.js";
import { structuredComplete } from "../services/claude.service.js";
import { suggestLocalMarketplaces } from "./local-marketplace-suggester.js";

const LocalRetailProductSchema = z.object({
  title: z.string().describe("Product or listing description"),
  price_usd: z.number().nullable().describe("Price in USD, null if unknown"),
  price_local: z.number().nullable().describe("Price in local currency, null if unknown"),
  local_currency_code: z.string().describe("3-letter currency code (e.g. CLP, BRL, MXN)"),
  seller_name: z.string().nullable().describe("Store or retailer name"),
  url: z.string().describe("Source URL"),
  source_domain: z.string().describe("Domain of the source website"),
});

const LocalRetailExtractionSchema = z.object({
  products: z.array(LocalRetailProductSchema).describe("Extracted local retail products, up to 10"),
});

const EXTRACTION_PROMPT = `You extract structured product pricing data from local retail search results for a specific country.
You will receive search results about product prices in a target country/market. Extract as many distinct products/prices as possible (up to 10).

Rules:
- Try to determine both the local price and approximate USD equivalent.
- If you only know the local price, set price_usd to null.
- Extract source_domain from the URL.`;

async function searchTavilyLocalMarketplaces(
  query: string,
  domains: string[],
  countryName: string,
  countryCode: string,
  localCurrencyCode: string,
): Promise<PlatformProduct[]> {
  if (domains.length === 0) return [];

  try {
    const response = await tavilySearch(`${query} price ${countryName}`, {
      include_domains: domains,
      max_results: 8,
      search_depth: "basic",
      include_answer: false,
    });

    if (response.results.length === 0) return [];

    const context = response.results
      .map((r: TavilyResult, i: number) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 500)}`)
      .join("\n\n---\n\n");

    const { products: extracted } = await structuredComplete({
      system: EXTRACTION_PROMPT,
      user: `Target country: ${countryName} (${countryCode})\nLocal currency: ${localCurrencyCode}\n\nExtract local retail prices:\n\n${context}`,
      schema: LocalRetailExtractionSchema,
      maxTokens: 2048,
    });

    return extracted.map((item): PlatformProduct => ({
      platform: "local_retail",
      title: item.title ?? "Untitled",
      price_raw: item.price_usd,
      price_formatted: item.price_usd != null ? `$${item.price_usd.toFixed(2)}` : "N/A",
      currency: "USD",
      price_local: item.price_local,
      local_currency_code: item.local_currency_code ?? localCurrencyCode,
      seller_name: item.seller_name ?? undefined,
      product_url: item.url ?? undefined,
      source_domain: item.source_domain ?? undefined,
    }));
  } catch (err) {
    console.error("Tavily local marketplace search failed:", err);
    return [];
  }
}

export async function searchLocalRetail(
  query: string,
  countryCode: string,
  countryName: string,
  localCurrencyCode: string,
): Promise<PlatformProduct[]> {
  const { domains, language_code } = await suggestLocalMarketplaces(countryCode, countryName);

  const [googleShoppingResults, tavilyResults] = await Promise.all([
    searchGoogleShoppingLocal(query, countryCode, language_code),
    searchTavilyLocalMarketplaces(query, domains, countryName, countryCode, localCurrencyCode),
  ]);

  return [...googleShoppingResults, ...tavilyResults];
}
