const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", NZ: "NZD",
  EU: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", PT: "EUR", IE: "EUR", AT: "EUR", BE: "EUR", FI: "EUR", GR: "EUR",
  JP: "JPY", CN: "CNY", KR: "KRW", IN: "INR", BR: "BRL",
  MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
  ZA: "ZAR", NG: "NGN", EG: "EGP", KE: "KES",
  TH: "THB", VN: "VND", PH: "PHP", MY: "MYR", SG: "SGD", ID: "IDR",
  TR: "TRY", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON",
  SE: "SEK", NO: "NOK", DK: "DKK", CH: "CHF",
  SA: "SAR", AE: "AED", IL: "ILS",
  TW: "TWD", HK: "HKD", PK: "PKR", BD: "BDT",
  UY: "UYU", PY: "PYG", BO: "BOB", EC: "USD", VE: "VES", CR: "CRC", PA: "PAB", DO: "DOP", GT: "GTQ",
};

export function currencyForCountry(countryCode: string): string {
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] ?? "USD";
}

interface ExchangeRateResult {
  currency_code: string;
  rate: number;
}

const cache = new Map<string, { data: ExchangeRateResult; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getExchangeRate(countryCode: string): Promise<ExchangeRateResult> {
  const currencyCode = currencyForCountry(countryCode);
  if (currencyCode === "USD") {
    return { currency_code: "USD", rate: 1 };
  }

  const cached = cache.get(currencyCode);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/USD`, {
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`);

    const json = (await res.json()) as { rates?: Record<string, number> };
    const rate = json.rates?.[currencyCode];

    if (rate == null) {
      console.warn(`No exchange rate found for ${currencyCode}, defaulting to 1`);
      return { currency_code: currencyCode, rate: 1 };
    }

    const result: ExchangeRateResult = { currency_code: currencyCode, rate };
    cache.set(currencyCode, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error("Exchange rate fetch failed:", err);
    return { currency_code: currencyCode, rate: 1 };
  }
}
