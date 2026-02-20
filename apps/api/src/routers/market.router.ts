import { router, publicProcedure } from "../trpc.js";

export const marketRouter = router({
  ping: publicProcedure.query(() => ({ status: "market router ok" })),
});
