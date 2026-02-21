import { config } from "dotenv";
import { resolve } from "path";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Load .env from cwd or monorepo root (when running from apps/api)
config({
  path: [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ],
});

export const env = createEnv({
  server: {
    // Anthropic
    ANTHROPIC_API_KEY: z.string().min(1),
    ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-20250514"),

    // SerpApi
    SERPAPI_API_KEY: z.string().min(1),
    SERPAPI_BASE_URL: z
      .string()
      .url()
      .default("https://serpapi.com/search.json"),
    SERPAPI_RESULTS_PER_PAGE: z.coerce.number().int().positive().default(10),
    SERPAPI_TRENDS_DATE: z.string().default("today 12-m"),

    // AliExpress Affiliate API (optional — falls back to Tavily wholesale)
    ALIEXPRESS_APP_KEY: z.string().optional(),
    ALIEXPRESS_APP_SECRET: z.string().optional(),

    // Tavily
    TAVILY_API_KEY: z.string().min(1),
    TAVILY_SEARCH_DEPTH: z.enum(["basic", "advanced"]).default("advanced"),
    TAVILY_MAX_RESULTS: z.coerce.number().int().positive().default(5),
    TAVILY_INCLUDE_ANSWER: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),

    // Server
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
    GEOLOCATION_API_URL: z
      .string()
      .url()
      .default("http://ip-api.com/json"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
