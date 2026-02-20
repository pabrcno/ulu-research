import { env } from "@repo/env/server";
import type { Platform, PlatformProduct } from "@repo/types";

interface SerpApiParams {
  engine: string;
  q?: string;
  [key: string]: string | number | boolean | undefined;
}

async function callSerpApi(params: SerpApiParams): Promise<Record<string, any>> {
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

// ─── Platform-specific result mappers ──────────────────────────────

function parsePrice(raw: string | number | null | undefined): { value: number | null; formatted: string } {
  if (raw == null) return { value: null, formatted: "N/A" };
  if (typeof raw === "number") return { value: raw, formatted: `$${raw.toFixed(2)}` };

  const str = String(raw);
  const match = str.match(/[\d,.]+/);
  if (!match) return { value: null, formatted: str || "N/A" };

  const num = parseFloat(match[0].replace(/,/g, ""));
  return { value: isNaN(num) ? null : num, formatted: str };
}

function mapAlibabaResults(data: Record<string, any>): PlatformProduct[] {
  const results: any[] = data.organic_results ?? [];
  return results.slice(0, env.SERPAPI_RESULTS_PER_PAGE).map((item) => {
    const price = parsePrice(item.price);
    return {
      platform: "alibaba" as const,
      external_id: item.position?.toString(),
      title: item.title ?? "Untitled",
      price_raw: price.value,
      price_formatted: price.formatted,
      currency: "USD",
      price_type: "wholesale" as const,
      moq: item.moq ? parseInt(String(item.moq).replace(/\D/g, ""), 10) || null : null,
      unit: item.unit ?? undefined,
      rating: item.rating ? parseFloat(String(item.rating)) : null,
      review_count: item.reviews ? parseInt(String(item.reviews).replace(/\D/g, ""), 10) || null : null,
      seller_name: item.supplier_name ?? item.seller ?? undefined,
      is_verified: item.is_verified ?? item.trade_assurance ?? undefined,
      product_url: item.link ?? undefined,
      image_url: item.thumbnail ?? undefined,
    };
  });
}

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
      price_type: "retail" as const,
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
      price_type: "variable" as const,
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
      price_type: "retail" as const,
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
      price_type: "retail" as const,
      rating: item.rating ? parseFloat(String(item.rating)) : null,
      review_count: item.reviews ? parseInt(String(item.reviews).replace(/\D/g, ""), 10) || null : null,
      seller_name: item.source ?? undefined,
      product_url: item.link ?? undefined,
      image_url: item.thumbnail ?? undefined,
    };
  });
}

const PLATFORM_CONFIG: Record<Platform, {
  engine: string;
  buildParams: (query: string) => SerpApiParams;
  mapResults: (data: Record<string, any>) => PlatformProduct[];
}> = {
  alibaba: {
    engine: "alibaba",
    buildParams: (q) => ({ engine: "alibaba", q, page: 1 }),
    mapResults: mapAlibabaResults,
  },
  amazon: {
    engine: "amazon",
    buildParams: (q) => ({ engine: "amazon", search_term: q, amazon_domain: "amazon.com" }),
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
  platform: Platform,
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

export async function searchAllPlatforms(
  query: string,
): Promise<Record<Platform, PlatformProduct[]>> {
  const platforms: Platform[] = ["alibaba", "amazon", "ebay", "walmart", "google_shopping"];

  const results = await Promise.all(
    platforms.map((p) => searchPlatform(p, query)),
  );

  return {
    alibaba: results[0]!,
    amazon: results[1]!,
    ebay: results[2]!,
    walmart: results[3]!,
    google_shopping: results[4]!,
  };
}
