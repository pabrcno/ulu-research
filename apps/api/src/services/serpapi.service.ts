import { env } from "@repo/env/server";
import type { PlatformProduct } from "@repo/types";

interface SerpApiParams {
  engine: string;
  q?: string;
  [key: string]: string | number | boolean | undefined;
}

export async function callSerpApi(params: SerpApiParams): Promise<Record<string, any>> {
  const url = new URL(env.SERPAPI_BASE_URL);
  url.searchParams.set("api_key", env.SERPAPI_API_KEY);
  url.searchParams.set("output", "json");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SerpApi ${params.engine} error ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json() as Promise<Record<string, any>>;
}

// ─── Price parser ───────────────────────────────────────────────────

function parsePrice(raw: string | number | null | undefined): { value: number | null; formatted: string } {
  if (raw == null) return { value: null, formatted: "N/A" };
  if (typeof raw === "number") return { value: raw, formatted: `$${raw.toFixed(2)}` };

  const str = String(raw);
  const match = str.match(/[\d,.]+/);
  if (!match) return { value: null, formatted: str || "N/A" };

  const num = parseFloat(match[0].replace(/,/g, ""));
  return { value: isNaN(num) ? null : num, formatted: str };
}

// ─── Platform-specific result mappers (no hardcoded price_type) ─────

function mapAmazonResults(data: Record<string, any>): PlatformProduct[] {
  const results: any[] = data.organic_results ?? [];
  return results.slice(0, env.SERPAPI_RESULTS_PER_PAGE).map((item) => {
    const priceObj = item.price ?? {};
    const rawPrice = priceObj.raw ?? priceObj.value ?? item.price_raw;
    const price = parsePrice(rawPrice);
    return {
      platform: "amazon" as const,
      external_id: item.asin ?? item.position?.toString(),
      title: item.title ?? "Untitled",
      price_raw: price.value ?? (priceObj.value ? parseFloat(String(priceObj.value)) : null),
      price_formatted: price.formatted,
      currency: priceObj.currency ?? "USD",
      rating: item.rating ? parseFloat(String(item.rating)) : null,
      review_count: item.reviews ? parseInt(String(item.reviews).replace(/\D/g, ""), 10) || null : null,
      seller_name: item.seller?.name ?? undefined,
      is_verified: item.is_prime ?? undefined,
      product_url: item.link ?? undefined,
      image_url: item.thumbnail ?? undefined,
    };
  });
}

function mapEbayResults(data: Record<string, any>): PlatformProduct[] {
  const results: any[] = data.organic_results ?? [];
  return results.slice(0, env.SERPAPI_RESULTS_PER_PAGE).map((item) => {
    const priceObj = item.price ?? {};
    const rawPrice = priceObj.raw ?? priceObj.extracted ?? item.price;
    const price = parsePrice(rawPrice);
    return {
      platform: "ebay" as const,
      external_id: item.epid ?? item.position?.toString(),
      title: item.title ?? "Untitled",
      price_raw: price.value ?? (priceObj.extracted ? parseFloat(String(priceObj.extracted)) : null),
      price_formatted: price.formatted,
      currency: priceObj.currency ?? "USD",
      rating: null,
      review_count: null,
      seller_name: item.seller_info?.name ?? undefined,
      product_url: item.link ?? undefined,
      image_url: item.thumbnail ?? undefined,
      condition: item.condition ?? undefined,
    };
  });
}

function mapWalmartResults(data: Record<string, any>): PlatformProduct[] {
  const results: any[] = data.organic_results ?? [];
  return results.slice(0, env.SERPAPI_RESULTS_PER_PAGE).map((item) => {
    const offerPrice = item.primary_offer?.offer_price;
    const rawPrice = offerPrice ?? item.price;
    const price = parsePrice(rawPrice);
    return {
      platform: "walmart" as const,
      external_id: item.us_item_id ?? item.product_id ?? item.position?.toString(),
      title: item.title ?? "Untitled",
      price_raw: price.value,
      price_formatted: price.formatted,
      currency: "USD",
      rating: item.rating ? parseFloat(String(item.rating)) : null,
      review_count: item.reviews ? parseInt(String(item.reviews).replace(/\D/g, ""), 10) || null : null,
      seller_name: item.seller_name ?? undefined,
      product_url: item.product_page_url ?? item.link ?? undefined,
      image_url: item.thumbnail ?? undefined,
    };
  });
}

function mapGoogleShoppingResults(data: Record<string, any>): PlatformProduct[] {
  const results: any[] = data.shopping_results ?? data.organic_results ?? [];
  return results.slice(0, env.SERPAPI_RESULTS_PER_PAGE).map((item) => {
    const rawPrice = item.extracted_price ?? item.price;
    const price = parsePrice(rawPrice);
    return {
      platform: "google_shopping" as const,
      external_id: item.product_id ?? item.position?.toString(),
      title: item.title ?? "Untitled",
      price_raw: price.value ?? (item.extracted_price ? parseFloat(String(item.extracted_price)) : null),
      price_formatted: price.formatted,
      currency: "USD",
      rating: item.rating ? parseFloat(String(item.rating)) : null,
      review_count: item.reviews ? parseInt(String(item.reviews).replace(/\D/g, ""), 10) || null : null,
      seller_name: item.source ?? undefined,
      product_url: item.link ?? undefined,
      image_url: item.thumbnail ?? undefined,
    };
  });
}

// ─── SerpApi platform configs (retail only — 4 engines) ─────────────

type SerpApiPlatform = "amazon" | "ebay" | "walmart" | "google_shopping";

const PLATFORM_CONFIG: Record<SerpApiPlatform, {
  engine: string;
  buildParams: (query: string) => SerpApiParams;
  mapResults: (data: Record<string, any>) => PlatformProduct[];
}> = {
  amazon: {
    engine: "amazon",
    buildParams: (q) => ({ engine: "amazon", k: q, amazon_domain: "amazon.com" }),
    mapResults: mapAmazonResults,
  },
  ebay: {
    engine: "ebay",
    buildParams: (q) => ({ engine: "ebay", _nkw: q, ebay_domain: "ebay.com" }),
    mapResults: mapEbayResults,
  },
  walmart: {
    engine: "walmart",
    buildParams: (q) => ({ engine: "walmart", query: q }),
    mapResults: mapWalmartResults,
  },
  google_shopping: {
    engine: "google_shopping",
    buildParams: (q) => ({ engine: "google_shopping", q, gl: "us", hl: "en" }),
    mapResults: mapGoogleShoppingResults,
  },
};

export async function searchPlatform(
  platform: SerpApiPlatform,
  query: string,
): Promise<PlatformProduct[]> {
  const config = PLATFORM_CONFIG[platform];
  try {
    const data = await callSerpApi(config.buildParams(query));
    return config.mapResults(data);
  } catch (err) {
    console.error(`SerpApi ${platform} search failed:`, err);
    return [];
  }
}

export async function searchAllRetailPlatforms(
  query: string,
): Promise<Record<SerpApiPlatform, PlatformProduct[]>> {
  const platforms: SerpApiPlatform[] = ["amazon", "ebay", "walmart", "google_shopping"];

  const results = await Promise.all(
    platforms.map((p) => searchPlatform(p, query)),
  );

  return {
    amazon: results[0]!,
    ebay: results[1]!,
    walmart: results[2]!,
    google_shopping: results[3]!,
  };
}

// ─── Google Shopping: wholesale + local variants ────────────────────

function mapGoogleShoppingAs(
  data: Record<string, any>,
  platform: "wholesale" | "local_retail",
): PlatformProduct[] {
  const results: any[] = data.shopping_results ?? data.organic_results ?? [];
  return results.slice(0, env.SERPAPI_RESULTS_PER_PAGE).map((item) => {
    const rawPrice = item.extracted_price ?? item.price;
    const price = parsePrice(rawPrice);
    return {
      platform,
      external_id: item.product_id ?? item.position?.toString(),
      title: item.title ?? "Untitled",
      price_raw: price.value ?? (item.extracted_price ? parseFloat(String(item.extracted_price)) : null),
      price_formatted: price.formatted,
      currency: "USD",
      rating: item.rating ? parseFloat(String(item.rating)) : null,
      review_count: item.reviews ? parseInt(String(item.reviews).replace(/\D/g, ""), 10) || null : null,
      seller_name: item.source ?? undefined,
      product_url: item.link ?? undefined,
      image_url: item.thumbnail ?? undefined,
      source_domain: item.source ?? undefined,
    };
  });
}

export async function searchGoogleShoppingWholesale(
  query: string,
): Promise<PlatformProduct[]> {
  const queries = [
    `${query} wholesale supplier bulk`,
    `${query} import wholesale china factory`,
  ];

  try {
    const results = await Promise.all(
      queries.map((q) =>
        callSerpApi({ engine: "google_shopping", q, gl: "us", hl: "en" })
          .then((data) => mapGoogleShoppingAs(data, "wholesale"))
          .catch((err) => {
            console.error("SerpApi Google Shopping wholesale failed:", err);
            return [] as PlatformProduct[];
          }),
      ),
    );

    const seen = new Set<string>();
    const merged: PlatformProduct[] = [];
    for (const batch of results) {
      for (const p of batch) {
        const key = p.title + "|" + (p.price_raw ?? "");
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(p);
        }
      }
    }
    return merged;
  } catch (err) {
    console.error("Google Shopping wholesale search failed:", err);
    return [];
  }
}

export async function searchGoogleShoppingLocal(
  query: string,
  countryCode: string,
  langCode: string,
): Promise<PlatformProduct[]> {
  try {
    const data = await callSerpApi({
      engine: "google_shopping",
      q: query,
      gl: countryCode.toLowerCase(),
      hl: langCode,
    });
    return mapGoogleShoppingAs(data, "local_retail");
  } catch (err) {
    console.error(`SerpApi Google Shopping local (${countryCode}) failed:`, err);
    return [];
  }
}

// ─── Google Trends (4 data types in parallel) ──────────────────────

export interface TrendsRawData {
  timeseries: Record<string, any>;
  geoMap: Record<string, any>;
  relatedQueries: Record<string, any>;
  relatedTopics: Record<string, any>;
}

export async function getTrends(
  keyword: string,
  geo: string,
  languageCode?: string,
): Promise<TrendsRawData> {
  const dateRange = env.SERPAPI_TRENDS_DATE || "today 12-m";

  // GEO_MAP requires multiple queries; GEO_MAP_0 ("Interest by region") accepts single query
  const dataTypes = ["TIMESERIES", "GEO_MAP_0", "RELATED_QUERIES", "RELATED_TOPICS"] as const;

  try {
    const results = await Promise.all(
      dataTypes.map((dataType) => {
        const params: SerpApiParams = {
          engine: "google_trends",
          q: keyword,
          data_type: dataType,
          geo: geo.toUpperCase(),
          date: dateRange,
        };

        // Add language parameter if provided (e.g., "es", "fr", "de")
        if (languageCode && languageCode !== "en") {
          params.hl = languageCode;
        }

        return callSerpApi(params).catch((err) => {
          console.error(`SerpApi Google Trends ${dataType} failed:`, err);
          return {};
        });
      }),
    );

    return {
      timeseries: results[0] ?? {},
      geoMap: results[1] ?? {},
      relatedQueries: results[2] ?? {},
      relatedTopics: results[3] ?? {},
    };
  } catch (err) {
    console.error("Google Trends search failed:", err);
    return {
      timeseries: {},
      geoMap: {},
      relatedQueries: {},
      relatedTopics: {},
    };
  }
}
