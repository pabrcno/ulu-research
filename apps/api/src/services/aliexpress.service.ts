import { createHash } from "crypto";
import type { PlatformProduct } from "@repo/types";

interface AliExpressConfig {
  appKey: string;
  appSecret: string;
}

function getConfig(): AliExpressConfig | null {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  if (!appKey || !appSecret) return null;
  return { appKey, appSecret };
}

function signRequest(
  params: Record<string, string>,
  secret: string,
): string {
  const sorted = Object.keys(params).sort();
  let baseString = secret;
  for (const key of sorted) {
    baseString += key + params[key];
  }
  baseString += secret;
  return createHash("md5").update(baseString, "utf8").digest("hex").toUpperCase();
}

export function isAliExpressConfigured(): boolean {
  return getConfig() !== null;
}

export async function searchAliExpress(query: string): Promise<PlatformProduct[]> {
  const config = getConfig();
  if (!config) return [];

  const params: Record<string, string> = {
    app_key: config.appKey,
    method: "aliexpress.affiliate.product.smartmatch",
    sign_method: "md5",
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    v: "2.0",
    format: "json",
    keywords: query,
    target_currency: "USD",
    target_language: "EN",
    page_no: "1",
    page_size: "10",
  };

  params.sign = signRequest(params, config.appSecret);

  const url = new URL("https://api-sg.aliexpress.com/sync");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.error(`AliExpress API error ${res.status}`);
      return [];
    }

    const data = await res.json() as any;
    const response =
      data?.aliexpress_affiliate_product_smartmatch_response?.resp_result?.result;

    if (!response?.products?.product) return [];

    const products: any[] = response.products.product;

    return products.slice(0, 10).map((item): PlatformProduct => {
      const price =
        parseFloat(item.target_app_sale_price) ||
        parseFloat(item.target_original_price) ||
        null;

      return {
        platform: "aliexpress",
        external_id: item.product_id?.toString(),
        title: item.product_title ?? "Untitled",
        price_raw: price,
        price_formatted: price != null ? `$${price.toFixed(2)}` : "N/A",
        currency: "USD",
        rating: item.evaluate_rate ? parseFloat(item.evaluate_rate) : null,
        seller_name: item.shop_name ?? undefined,
        product_url: item.product_detail_url ?? item.promotion_link ?? undefined,
        image_url: item.product_main_image_url ?? undefined,
        sales_volume: item.lastest_volume?.toString() ?? undefined,
        source_domain: "aliexpress.com",
      };
    });
  } catch (err) {
    console.error("AliExpress API search failed:", err);
    return [];
  }
}
