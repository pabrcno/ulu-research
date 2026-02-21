import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildApp } from "../src/app";

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

async function getApp() {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fastify = await getApp();

  const response = await fastify.inject({
    method: req.method as any,
    url: req.url || "/",
    headers: req.headers as Record<string, string>,
    payload: req.body ?? undefined,
  });

  res.status(response.statusCode);
  for (const [key, value] of Object.entries(response.headers)) {
    if (value !== undefined) {
      res.setHeader(key, value as string | string[]);
    }
  }
  res.end(response.rawPayload);
}
