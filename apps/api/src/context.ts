import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

export function createContext({ req, res }: CreateFastifyContextOptions) {
  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "127.0.0.1";

  return {
    req,
    res,
    clientIp,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
