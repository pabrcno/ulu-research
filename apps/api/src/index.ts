import Fastify from "fastify";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";
import { env } from "@repo/env/server";

async function main() {
  const server = Fastify({ logger: true });

  await server.register(cors, { origin: env.CORS_ORIGIN });

  await server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext },
  });

  server.get("/ping", async () => ({ status: "ok", timestamp: Date.now() }));

  await server.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
