import { router, publicProcedure } from "../trpc.js";

export const trendsRouter = router({
  ping: publicProcedure.query(() => ({ status: "trends router ok" })),
});
