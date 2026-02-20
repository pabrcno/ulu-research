import { router, publicProcedure } from "../trpc.js";

export const opportunityRouter = router({
  ping: publicProcedure.query(() => ({ status: "opportunity router ok" })),
});
