import { router, publicProcedure } from "../trpc.js";
import { SearchQuerySchema, SessionInitResponseSchema } from "@repo/types";
import { geolocateIp } from "../services/geolocation.service.js";
import { extractKeywords } from "../lib/keyword-extractor.js";
import { getCountryName } from "../lib/countries.js";
import { randomUUID } from "node:crypto";

export const searchRouter = router({
  initiate: publicProcedure
    .input(SearchQuerySchema)
    .output(SessionInitResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const geo = await geolocateIp(ctx.clientIp);

      const countryCode = input.country_code ?? geo?.country_code ?? "US";

      const productMetadata = await extractKeywords(
        input.raw_query,
        countryCode,
      );

      const sessionId = randomUUID();

      const geolocation =
        input.country_code != null
          ? {
              country_code: input.country_code,
              country_name: getCountryName(input.country_code),
            }
          : geo ?? {
              country_code: countryCode,
              country_name: getCountryName(countryCode),
            };

      return {
        session_id: sessionId,
        geolocation,
        product_metadata: {
          ...productMetadata,
          id: randomUUID(),
          session_id: sessionId,
        },
      };
    }),
});
