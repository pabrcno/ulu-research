import { router, publicProcedure } from "../trpc.js";

export const regulationsRouter = router({
  ping: publicProcedure.query(() => ({ status: "regulations router ok" })),
});
