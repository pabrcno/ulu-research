import { router, publicProcedure } from "../trpc.js";
import { z } from "zod";

export const searchRouter = router({
  ping: publicProcedure.query(() => ({ status: "search router ok" })),
});
