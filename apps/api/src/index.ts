import { buildApp } from "./app.js";
import { env } from "@repo/env/server";

async function main() {
  const server = await buildApp();

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
