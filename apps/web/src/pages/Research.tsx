import { useState } from "react";
import { trpc } from "../trpc";
import { SearchBar } from "../components/SearchBar";
import { SourcingPanel } from "../components/SourcingPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Package, Tag, TrendingUp, Shield, ShoppingBag, FileSearch, Receipt } from "lucide-react";
import type { SessionInitResponse } from "@repo/types";

export function Research() {
  const [session, setSession] = useState<SessionInitResponse | null>(null);

  const health = trpc.health.useQuery(undefined, {
    refetchInterval: 10_000,
    retry: 2,
  });

  const initiate = trpc.search.initiate.useMutation({
    onSuccess: (data) => setSession(data),
  });

  function handleSearch(query: string, countryCode?: string) {
    setSession(null);
    initiate.mutate({ raw_query: query, country_code: countryCode });
  }

  const meta = session?.product_metadata;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">
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
                health.isSuccess
                  ? "bg-green-500"
                  : health.isError
                    ? "bg-red-500"
                    : "bg-amber-500 animate-pulse"
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

        <SearchBar
          onSearch={handleSearch}
          isLoading={initiate.isPending}
        />

        {initiate.isError && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {initiate.error.message || "Failed to analyze query. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        {meta && (
          <div className="mt-6 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5" />
                    {meta.product_name}
                  </CardTitle>
                  {meta.extraction_confidence != null && (
                    <Badge variant="outline" className="text-xs">
                      {Math.round(meta.extraction_confidence * 100)}% confidence
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <MetadataSection
                    icon={<Tag className="h-4 w-4" />}
                    label="Category & HS Code"
                  >
                    <span>{meta.product_category}</span>
                    <Badge variant="secondary" className="ml-2 font-mono text-xs">
                      HS {meta.hs_code}
                    </Badge>
                  </MetadataSection>

                  <MetadataSection
                    icon={<Shield className="h-4 w-4" />}
                    label="Regulatory Flags"
                  >
                    <div className="flex flex-wrap gap-1">
                      {meta.regulatory_flags.length > 0 ? (
                        meta.regulatory_flags.map((flag) => (
                          <Badge key={flag} variant="outline" className="text-xs">
                            {flag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">None detected</span>
                      )}
                    </div>
                  </MetadataSection>

                  <MetadataSection
                    icon={<FileSearch className="h-4 w-4" />}
                    label="Import Regulations"
                  >
                    <div className="flex flex-wrap gap-1">
                      {meta.import_regulations?.length > 0 ? (
                        meta.import_regulations.map((r) => (
                          <Badge key={r} variant="outline" className="text-xs">
                            {r}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">None detected</span>
                      )}
                    </div>
                  </MetadataSection>

                  <MetadataSection
                    icon={<Receipt className="h-4 w-4" />}
                    label="Impositive Regulations"
                  >
                    <div className="flex flex-wrap gap-1">
                      {meta.impositive_regulations?.length > 0 ? (
                        meta.impositive_regulations.map((r) => (
                          <Badge key={r} variant="outline" className="text-xs">
                            {r}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">None detected</span>
                      )}
                    </div>
                  </MetadataSection>

                  <MetadataSection
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Trend Keywords"
                  >
                    <div className="flex flex-wrap gap-1">
                      {meta.trend_keywords.map((kw) => (
                        <Badge key={kw} className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </MetadataSection>

                  <MetadataSection
                    icon={<ShoppingBag className="h-4 w-4" />}
                    label="Market Terms"
                  >
                    <div className="flex flex-wrap gap-1">
                      {meta.market_search_terms.map((term) => (
                        <Badge key={term} variant="secondary" className="text-xs">
                          {term}
                        </Badge>
                      ))}
                    </div>
                  </MetadataSection>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Normalized query:{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                      {meta.normalized_query}
                    </code>
                  </p>
                </div>
              </CardContent>
            </Card>

            <SourcingPanel
              normalizedQuery={meta.normalized_query}
              countryCode={session.geolocation.country_code}
              countryName={session.geolocation.country_name}
              enabled={!!meta}
            />

            <p className="text-sm text-muted-foreground text-center">
              Trends, regulations, and market panels will appear here in Phase 3–5.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetadataSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
