import { getCountryName } from "./countries.js";

export interface ImpositiveQuery {
  query: string;
  purpose: string;
  include_domains?: string[];
}

/**
 * Builds targeted Tavily queries for tax, duty, and landed cost research.
 * Separate from compliance queries — focused purely on "how much will it cost?"
 */
export function buildImpositiveQueries(
  hsCode: string,
  productName: string,
  countryCode: string,
  impositiveRegulations: string[],
): ImpositiveQuery[] {
  const countryName = getCountryName(countryCode);
  const queries: ImpositiveQuery[] = [];

  // Query 1: Import duty / tariff rate for the HS code
  queries.push({
    query: `HS code ${hsCode} import tariff duty rate percentage ${countryName} 2025 2026`,
    purpose: "duty_rate",
    include_domains: getTaxDomains(countryCode),
  });

  // Query 2: VAT / sales tax on imports
  queries.push({
    query: `${countryName} import VAT sales tax rate ${productName} consumer goods`,
    purpose: "vat_rate",
    include_domains: getTaxDomains(countryCode),
  });

  // Query 3: Additional import fees, surcharges, anti-dumping duties
  queries.push({
    query: `${countryName} import additional fees customs processing surcharge anti-dumping ${hsCode}`,
    purpose: "additional_fees",
    include_domains: getTaxDomains(countryCode),
  });

  // Query 4: Total cost to import / landed cost guide
  queries.push({
    query: `how to calculate total landed cost importing ${productName} to ${countryName} shipping duty tax`,
    purpose: "landed_cost_guide",
  });

  // Query 5: Specific impositive regulations from metadata
  if (impositiveRegulations.length > 0) {
    const taxes = impositiveRegulations.slice(0, 3).join(" ");
    queries.push({
      query: `${countryName} import ${taxes} rate ${hsCode} ${productName}`,
      purpose: "specific_impositive",
      include_domains: getTaxDomains(countryCode),
    });
  }

  return queries;
}

function getTaxDomains(countryCode: string): string[] {
  const domains: Record<string, string[]> = {
    US: ["cbp.gov", "trade.gov", "usitc.gov", "irs.gov"],
    GB: ["gov.uk", "hmrc.gov.uk", "trade.gov.uk"],
    DE: ["zoll.de", "bmf.de"],
    FR: ["douane.gouv.fr", "impots.gouv.fr"],
    ES: ["agenciatributaria.es", "aeat.es"],
    IT: ["agenziadogane.it", "agenziaentrate.gov.it"],
    CA: ["cbsa-asfc.gc.ca", "canada.ca"],
    AU: ["abf.gov.au", "ato.gov.au"],
    JP: ["customs.go.jp", "nta.go.jp"],
    CN: ["customs.gov.cn", "chinatax.gov.cn"],
    IN: ["cbic.gov.in", "incometaxindia.gov.in"],
    BR: ["gov.br", "receita.fazenda.gov.br"],
    MX: ["gob.mx", "sat.gob.mx"],
    AR: ["argentina.gob.ar", "afip.gob.ar"],
    CL: ["aduana.cl", "sii.cl"],
    KR: ["customs.go.kr", "nts.go.kr"],
    SG: ["customs.gov.sg", "iras.gov.sg"],
    NZ: ["customs.govt.nz", "ird.govt.nz"],
    TH: ["customs.go.th", "rd.go.th"],
    MY: ["customs.gov.my", "hasil.gov.my"],
    ID: ["beacukai.go.id", "pajak.go.id"],
    VN: ["customs.gov.vn"],
    AE: ["government.ae", "tax.gov.ae"],
    SA: ["customs.gov.sa", "gazt.gov.sa"],
    TR: ["ticaret.gov.tr", "gib.gov.tr"],
    ZA: ["sars.gov.za"],
    PL: ["gov.pl", "podatki.gov.pl"],
    NL: ["government.nl", "belastingdienst.nl"],
    SE: ["tullverket.se", "skatteverket.se"],
    NO: ["toll.no", "skatteetaten.no"],
    DK: ["skat.dk", "toldst.dk"],
    FI: ["tulli.fi", "vero.fi"],
    AT: ["bmf.gv.at"],
    CH: ["bazg.admin.ch", "estv.admin.ch"],
    IE: ["revenue.ie"],
    PT: ["portaldasfinancas.gov.pt"],
    CZ: ["celnisprava.cz"],
    HU: ["nav.gov.hu"],
    RO: ["anaf.ro"],
    CO: ["dian.gov.co"],
    PE: ["sunat.gob.pe"],
    PH: ["customs.gov.ph", "bir.gov.ph"],
  };

  return domains[countryCode] ?? [];
}
