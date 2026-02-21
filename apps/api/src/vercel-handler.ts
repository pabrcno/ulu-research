import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "./app.js";

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

async function getApp() {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const fastify = await getApp();

  const response = await fastify.inject({
    method: req.method as any,
    url: req.url || "/",
    headers: req.headers as Record<string, string>,
    payload: await readBody(req),
  });

  res.statusCode = response.statusCode;
  for (const [key, value] of Object.entries(response.headers)) {
    if (value !== undefined) {
      res.setHeader(key, value as string | string[]);
    }
  }
  res.end(response.rawPayload);
}

function readBody(req: IncomingMessage): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (req.method === "GET" || req.method === "HEAD") {
      resolve(undefined);
      return;
    }
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () =>
      resolve(chunks.length > 0 ? Buffer.concat(chunks).toString() : undefined),
    );
    req.on("error", () => resolve(undefined));
  });
}
