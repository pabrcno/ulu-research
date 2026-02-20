import { router, publicProcedure } from "../trpc.js";

export const sourcingRouter = router({
  ping: publicProcedure.query(() => ({ status: "sourcing router ok" })),
});
