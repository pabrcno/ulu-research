import { z } from "zod";
import { structuredComplete } from "../services/claude.service.js";

const SuggestionSchema = z.object({
  domains: z.array(z.string()).describe("Top 5-8 e-commerce/retail marketplace domains where consumers buy products online in this country. Use country-specific domains (e.g. mercadolibre.com.ar not mercadolibre.com)"),
  language_code: z.string().describe("ISO 639-1 language code for this country's primary language (e.g. es, pt, en, fr, de)"),
});

const SYSTEM_PROMPT = `Given a country, return the top 5-8 e-commerce and retail marketplace domains where consumers in that country typically buy products online. Include both local marketplaces and international ones popular in that country.

Examples:
- Argentina: mercadolibre.com.ar, fravega.com, garbarino.com, musimundo.com, amazon.com
- Brazil: mercadolivre.com.br, magazineluiza.com.br, americanas.com.br, amazon.com.br
- Chile: mercadolibre.cl, falabella.com, ripley.cl, paris.cl, lider.cl
- Mexico: mercadolibre.com.mx, amazon.com.mx, liverpool.com.mx, walmart.com.mx
- USA: amazon.com, walmart.com, target.com, bestbuy.com, costco.com

Use country-specific domain variants when they exist. Also provide the primary language code for Google searches.`;

const cache = new Map<string, { domains: string[]; language_code: string }>();

export async function suggestLocalMarketplaces(
  countryCode: string,
  countryName: string,
): Promise<{ domains: string[]; language_code: string }> {
  const cached = cache.get(countryCode);
  if (cached) return cached;

  try {
    const result = await structuredComplete({
      system: SYSTEM_PROMPT,
      user: `Country: ${countryName} (${countryCode})`,
      schema: SuggestionSchema,
      maxTokens: 512,
    });

    cache.set(countryCode, result);
    return result;
  } catch (err) {
    console.error(`Local marketplace suggestion failed for ${countryCode}:`, err);
    return { domains: [], language_code: "en" };
  }
}
