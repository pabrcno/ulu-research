import { trpc } from "../trpc";

export function Research() {
  const health = trpc.health.useQuery(undefined, {
    refetchInterval: 10_000,
    retry: 2,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Wholesale Research Platform
            </h1>
            <p className="text-muted-foreground">
              Research product sourcing, trends, regulations, and market
              opportunity in one search.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-full ${
                health.isSuccess ? "bg-green-500" : health.isError ? "bg-red-500" : "bg-amber-500 animate-pulse"
              }`}
              aria-hidden
            />
            <span className="text-sm text-muted-foreground">
              {health.isLoading && "Checking..."}
              {health.isSuccess && "API connected"}
              {health.isError && "API disconnected"}
            </span>
          </div>
        </div>
        <div className="text-muted-foreground text-sm">
          Search bar and panels will appear here after Phase 1.
        </div>
      </div>
    </div>
  );
}
