import { router, publicProcedure } from "./trpc.js";
import { searchRouter } from "./routers/search.router.js";
import { sourcingRouter } from "./routers/sourcing.router.js";
import { trendsRouter } from "./routers/trends.router.js";
import { regulationsRouter } from "./routers/regulations.router.js";
import { marketRouter } from "./routers/market.router.js";
import { opportunityRouter } from "./routers/opportunity.router.js";

export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: Date.now(),
  })),
  search: searchRouter,
  sourcing: sourcingRouter,
  trends: trendsRouter,
  regulations: regulationsRouter,
  market: marketRouter,
  opportunity: opportunityRouter,
});

export type AppRouter = typeof appRouter;
