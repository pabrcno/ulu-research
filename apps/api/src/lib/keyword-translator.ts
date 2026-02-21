import { structuredComplete } from "../services/claude.service.js";
import { z } from "zod";
import { getCountryLanguage } from "./countries.js";

const TranslationResultSchema = z.object({
  translated_keyword: z.string(),
  language_code: z.string(),
  language_name: z.string(),
});

const TRANSLATION_SYSTEM = `You are a professional translator specializing in e-commerce and product terminology.

Your task is to translate product search keywords from English to the target language while maintaining:
1. Natural phrasing that locals would use when searching
2. Common e-commerce terminology
3. SEO-friendly search terms
4. Cultural relevance

Guidelines:
- Use the most common/popular term for the product in the target market
- Consider regional variations (e.g., "mobile phone" vs "cell phone")
- Keep brand names and technical terms in their original form if commonly used
- Use lowercase unless the term is typically capitalized in that language
- Return only the translated keyword, no explanations

If the target language is English or the keyword is already appropriate, return the original keyword.`;

export async function translateKeyword(
  keyword: string,
  countryCode: string,
): Promise<{ translated: string; languageCode: string; languageName: string }> {
  const language = getCountryLanguage(countryCode);

  // If English, return original
  if (language.code === "en") {
    return {
      translated: keyword,
      languageCode: "en",
      languageName: "English",
    };
  }

  const userPrompt = `Translate this product search keyword to ${language.name} (${language.code}):

Keyword: "${keyword}"

Target Language: ${language.name}
Target Country: ${countryCode}

Provide the most natural and commonly used search term for this product in the target market.`;

  try {
    const result = await structuredComplete({
      system: TRANSLATION_SYSTEM,
      user: userPrompt,
      schema: TranslationResultSchema,
      maxTokens: 256,
    });

    return {
      translated: result.translated_keyword,
      languageCode: result.language_code,
      languageName: result.language_name,
    };
  } catch (err) {
    console.error("Keyword translation failed:", err);
    // Fallback to original keyword
    return {
      translated: keyword,
      languageCode: language.code,
      languageName: language.name,
    };
  }
}
