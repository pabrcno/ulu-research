import { getCountryName } from "./countries.js";

export interface MarketQuery {
  query: string;
  purpose: string;
  include_domains?: string[];
}

export function buildMarketQueries(
  marketTerms: string[],
  countryCode: string,
): MarketQuery[] {
  const countryName = getCountryName(countryCode);
  const termsStr = marketTerms.join(" ");
  const queries: MarketQuery[] = [];

  queries.push({
    query: `top competitors ${termsStr} market ${countryName} 2025 2026`,
    purpose: "competitors",
  });

  queries.push({
    query: `best e-commerce channels to sell ${termsStr} ${countryName}`,
    purpose: "channels",
  });

  queries.push({
    query: `consumer demand ${termsStr} market size growth ${countryName}`,
    purpose: "demand",
  });

  queries.push({
    query: `${termsStr} product positioning strategy ${countryName} market`,
    purpose: "positioning",
  });

  queries.push({
    query: `${termsStr} market trends competitive landscape ${countryName}`,
    purpose: "landscape",
  });

  return queries;
}
