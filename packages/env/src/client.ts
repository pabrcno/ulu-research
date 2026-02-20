import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_API_URL: z.string().url().default("http://localhost:3001"),
  },
  runtimeEnvStrict: {
    VITE_API_URL: (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL,
  },
  emptyStringAsUndefined: true,
});
