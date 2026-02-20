import Anthropic from "@anthropic-ai/sdk";
import { env } from "@repo/env/server";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

export async function complete<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const { system, user, maxTokens = 2048 } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text block in Claude response");
      }

      const raw = textBlock.text.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON object found in Claude response: ${raw.slice(0, 200)}`);
      }

      return JSON.parse(jsonMatch[0]) as T;
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
