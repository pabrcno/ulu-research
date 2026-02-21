import { env } from "@repo/env/server";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
}

export interface TavilyResponse {
  query: string;
  answer?: string;
  results: TavilyResult[];
}

export async function tavilySearch(
  query: string,
  options?: {
    include_domains?: string[];
    search_depth?: string;
    max_results?: number;
    include_answer?: boolean;
  },
): Promise<TavilyResponse> {
  const body = {
    api_key: env.TAVILY_API_KEY,
    query,
    search_depth: options?.search_depth ?? env.TAVILY_SEARCH_DEPTH,
    max_results: options?.max_results ?? env.TAVILY_MAX_RESULTS,
    include_answer: options?.include_answer ?? env.TAVILY_INCLUDE_ANSWER,
    include_domains: options?.include_domains,
  };

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily error ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json() as Promise<TavilyResponse>;
}
