import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { env } from "@repo/env/server";
import type { z } from "zod";

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

function createModel(maxTokens: number) {
  return new ChatAnthropic({
    model: env.ANTHROPIC_MODEL,
    apiKey: env.ANTHROPIC_API_KEY,
    temperature: 0,
    maxTokens,
  });
}

export async function structuredComplete<T extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const { system, user, schema, maxTokens = 2048 } = opts;

  const structuredModel = createModel(maxTokens).withStructuredOutput(schema, {
    name: "structured_response",
  });

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await structuredModel.invoke(
        [new SystemMessage(system), new HumanMessage(user)],
      );

      return result;
    } catch (err: any) {
      lastError = err;

      const isRetryable =
        err?.status === 429 ||
        err?.status === 529 ||
        err?.status >= 500 ||
        err?.code === "ECONNRESET";

      if (!isRetryable || attempt === MAX_RETRIES - 1) throw err;

      const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
