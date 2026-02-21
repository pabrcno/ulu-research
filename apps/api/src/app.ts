import Fastify from "fastify";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";
import { env } from "@repo/env/server";

export async function buildApp() {
  const server = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024,
  });

  await server.register(cors, { origin: env.CORS_ORIGIN });

  await server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext },
  });

  server.get("/ping", async () => ({ status: "ok", timestamp: Date.now() }));

  return server;
}
