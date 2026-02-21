import { getCountryName } from "./countries.js";

export interface RegulationQuery {
  query: string;
  purpose: string;
  include_domains?: string[];
}

/**
 * Builds 5-6 targeted Tavily queries for import regulation research
 * Biased toward .gov and customs authority domains
 */
export function buildRegulationQueries(
  hsCode: string,
  countryCode: string,
  regulatoryFlags: string[],
  importRegulations: string[],
  impositiveRegulations: string[],
): RegulationQuery[] {
  const countryName = getCountryName(countryCode);
  const queries: RegulationQuery[] = [];

  // Query 1: HS tariff duty rate
  queries.push({
    query: `HS code ${hsCode} import duty tariff rate ${countryName}`,
    purpose: "duty_rate",
    include_domains: getCustomsDomains(countryCode),
  });

  // Query 2: Required certifications
  if (regulatoryFlags.length > 0) {
    const certifications = regulatoryFlags.join(" ");
    queries.push({
      query: `HS ${hsCode} import certification requirements ${certifications} ${countryName}`,
      purpose: "certifications",
      include_domains: getCustomsDomains(countryCode),
    });
  } else {
    queries.push({
      query: `HS ${hsCode} import certification standards requirements ${countryName}`,
      purpose: "certifications",
      include_domains: getCustomsDomains(countryCode),
    });
  }

  // Query 3: Prohibited variants and restrictions
  if (importRegulations.length > 0) {
    const restrictions = importRegulations.join(" ");
    queries.push({
      query: `HS ${hsCode} prohibited restricted import ${restrictions} ${countryName}`,
      purpose: "prohibitions",
      include_domains: getCustomsDomains(countryCode),
    });
  } else {
    queries.push({
      query: `HS ${hsCode} prohibited restricted banned import ${countryName}`,
      purpose: "prohibitions",
      include_domains: getCustomsDomains(countryCode),
    });
  }

  // Query 4: Labeling and marking requirements
  queries.push({
    query: `HS ${hsCode} labeling marking packaging requirements import ${countryName}`,
    purpose: "labeling",
    include_domains: getCustomsDomains(countryCode),
  });

  // Query 5: Licensing, permits, and quotas
  queries.push({
    query: `HS ${hsCode} import license permit quota ${countryName}`,
    purpose: "licensing",
    include_domains: getCustomsDomains(countryCode),
  });

  // Query 6 (conditional): Impositive regulations (tariffs, VAT, duties)
  if (impositiveRegulations.length > 0) {
    const taxes = impositiveRegulations.join(" ");
    queries.push({
      query: `HS ${hsCode} import ${taxes} customs duties ${countryName}`,
      purpose: "impositive",
      include_domains: getCustomsDomains(countryCode),
    });
  }

  return queries;
}

/**
 * Returns official customs and government domains for a given country
 * Helps Tavily prioritize authoritative sources
 */
function getCustomsDomains(countryCode: string): string[] {
  const domains: Record<string, string[]> = {
    US: ["cbp.gov", "trade.gov", "census.gov", "usitc.gov"],
    GB: ["gov.uk", "hmrc.gov.uk"],
    DE: ["zoll.de", "bmwk.de"],
    FR: ["douane.gouv.fr", "entreprises.gouv.fr"],
    ES: ["agenciatributaria.es", "aeat.es"],
    IT: ["agenziadogane.it"],
    CA: ["cbsa-asfc.gc.ca"],
    AU: ["abf.gov.au", "austrade.gov.au"],
    NZ: ["customs.govt.nz"],
    JP: ["customs.go.jp"],
    CN: ["customs.gov.cn"],
    IN: ["cbic.gov.in"],
    BR: ["gov.br"],
    MX: ["gob.mx"],
    AR: ["argentina.gob.ar"],
    CL: ["aduana.cl"],
    SG: ["customs.gov.sg"],
    HK: ["customs.gov.hk"],
    KR: ["customs.go.kr"],
    TW: ["customs.gov.tw"],
    TH: ["customs.go.th"],
    MY: ["customs.gov.my"],
    ID: ["beacukai.go.id"],
    PH: ["customs.gov.ph"],
    VN: ["customs.gov.vn"],
    AE: ["government.ae"],
    SA: ["customs.gov.sa"],
    TR: ["ticaret.gov.tr"],
    ZA: ["sars.gov.za"],
    RU: ["customs.gov.ru"],
    PL: ["gov.pl"],
    NL: ["government.nl"],
    BE: ["belgium.be"],
    SE: ["tullverket.se"],
    NO: ["toll.no"],
    DK: ["skat.dk"],
    FI: ["tulli.fi"],
    AT: ["bmf.gv.at"],
    CH: ["bazg.admin.ch"],
    IE: ["revenue.ie"],
    PT: ["portaldasfinancas.gov.pt"],
    GR: ["gsis.gr"],
    CZ: ["celnisprava.cz"],
    HU: ["nav.gov.hu"],
    RO: ["anaf.ro"],
    BG: ["customs.bg"],
  };

  return domains[countryCode] || [`${countryCode.toLowerCase()}.gov`];
}
