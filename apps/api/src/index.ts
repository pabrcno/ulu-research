import Fastify from "fastify";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";
import { env } from "@repo/env/server";

async function main() {
  const server = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB — opportunity.synthesize receives 5 large reports
  });

  await server.register(cors, { origin: env.CORS_ORIGIN });

  await server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: { router: appRouter, createContext },
  });

  server.get("/ping", async () => ({ status: "ok", timestamp: Date.now() }));

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await server.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
