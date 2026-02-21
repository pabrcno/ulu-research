import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildApp } from "../src/app.js";

let appReady: ReturnType<typeof buildApp> | null = null;

async function getApp() {
  if (!appReady) {
    appReady = buildApp().then(async (app) => {
      await app.ready();
      return app;
    });
  }
  return appReady;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  app.server.emit("request", req, res);
}
