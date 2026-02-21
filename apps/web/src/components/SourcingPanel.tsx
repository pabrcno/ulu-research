import { useState, useEffect } from "react";
import { trpc } from "../trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  ExternalLink,
  Star,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Loader2,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PlatformProduct, Platform, SourcingSearchResponse } from "@repo/types";

const PLATFORM_LABELS: Record<Platform, string> = {
  aliexpress: "AliExpress",
  wholesale: "Wholesale",
  amazon: "Amazon",
  ebay: "eBay",
  walmart: "Walmart",
  google_shopping: "Google Shopping",
  local_retail: "Local Retail",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  aliexpress: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  wholesale: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  amazon: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ebay: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  walmart: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  google_shopping: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  local_retail: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

interface SourcingPanelProps {
  normalizedQuery: string;
  countryCode: string;
  countryName: string;
  sessionId?: string;
  enabled: boolean;
  onDataLoaded?: (data: SourcingSearchResponse) => void;
}

function formatDualPrice(
  usd: number | null | undefined,
  local: number | null | undefined,
  localCurrency: string,
): string {
  if (usd == null && local == null) return "N/A";
  const usdStr = usd != null ? `$${usd.toFixed(2)}` : "—";
  if (!localCurrency || localCurrency === "USD") return usdStr;
  const localStr = local != null ? `${localCurrency} ${local.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";
  return `${usdStr} / ${localStr}`;
}

export function SourcingPanel({ normalizedQuery, countryCode, countryName, sessionId, enabled, onDataLoaded }: SourcingPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("summary");

  const sourcing = trpc.sourcing.search.useQuery(
    { normalized_query: normalizedQuery, country_code: countryCode, country_name: countryName, session_id: sessionId },
    { enabled, staleTime: 60 * 60 * 1000, retry: 1 },
  );

  useEffect(() => {
    if (sourcing.data && onDataLoaded) {
      onDataLoaded(sourcing.data);
    }
  }, [sourcing.data, onDataLoaded]);

  if (!enabled) return null;

  if (sourcing.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-3" />
          <span className="text-muted-foreground">
            Searching 7 sources in parallel (wholesale, retail, local)...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (sourcing.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Sourcing search failed: {sourcing.error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!sourcing.data) return null;

  const { platforms, price_analysis, local_currency_code, exchange_rate } = sourcing.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingCart className="h-5 w-5" />
          Product Sourcing
          {local_currency_code && local_currency_code !== "USD" && (
            <Badge variant="outline" className="text-xs font-normal ml-auto">
              1 USD = {exchange_rate.toFixed(2)} {local_currency_code}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PriceSummaryBar analysis={price_analysis} localCurrency={local_currency_code} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
              <TabsTrigger key={p} value={p}>
                {PLATFORM_LABELS[p]}
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                  {platforms[p].length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="summary">
            <div className="rounded-lg border p-4 text-sm leading-relaxed">
              {price_analysis.summary}
            </div>
          </TabsContent>

          {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
            <TabsContent key={p} value={p}>
              <PlatformProductGrid products={platforms[p]} platform={p} localCurrency={local_currency_code} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function PriceSummaryBar({
  analysis,
  localCurrency,
}: {
  analysis: SourcingSearchResponse["price_analysis"];
  localCurrency: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <SummaryCell
        label="Wholesale Floor"
        value={formatDualPrice(analysis.wholesale_floor, analysis.wholesale_floor_local, localCurrency)}
        icon={<TrendingDown className="h-4 w-4 text-green-600" />}
      />
      <SummaryCell
        label="Retail Ceiling"
        value={formatDualPrice(analysis.retail_ceiling, analysis.retail_ceiling_local, localCurrency)}
        icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
      />
      <SummaryCell
        label="Local Retail Median"
        value={formatDualPrice(analysis.local_retail_median, analysis.local_retail_median_local, localCurrency)}
        icon={<MapPin className="h-4 w-4 text-purple-600" />}
      />
      <SummaryCell
        label="Margin Range"
        value={
          analysis.gross_margin_pct_min != null && analysis.gross_margin_pct_max != null
            ? `${analysis.gross_margin_pct_min.toFixed(0)}% – ${analysis.gross_margin_pct_max.toFixed(0)}%`
            : "N/A"
        }
        icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
      />
      <SummaryCell
        label="Best Source"
        value={analysis.best_source_platform ? PLATFORM_LABELS[analysis.best_source_platform] : "N/A"}
        icon={<Star className="h-4 w-4 text-amber-500" />}
      />
    </div>
  );
}

function SummaryCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function PlatformProductGrid({
  products,
  platform,
  localCurrency,
}: {
  products: PlatformProduct[];
  platform: Platform;
  localCurrency: string;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        No products found on {PLATFORM_LABELS[platform]}.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {products.map((product, idx) => (
        <ProductCard key={product.external_id ?? idx} product={product} localCurrency={localCurrency} />
      ))}
    </div>
  );
}

function ProductCard({ product, localCurrency }: { product: PlatformProduct; localCurrency: string }) {
  return (
    <div className="rounded-lg border p-3 flex gap-3">
      {product.image_url && (
        <img
          src={product.image_url}
          alt=""
          className="h-20 w-20 rounded-md object-cover flex-shrink-0 bg-muted"
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <h4 className="text-sm font-medium leading-tight line-clamp-2">
          {product.title}
        </h4>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold">
            {formatDualPrice(product.price_raw, product.price_local, localCurrency)}
          </span>
          {product.source_domain && (
            <Badge variant="outline" className="text-xs">
              {product.source_domain}
            </Badge>
          )}
          {product.moq != null && (
            <span className="text-xs text-muted-foreground">
              MOQ: {product.moq} {product.unit ?? "pcs"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {product.rating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {product.rating.toFixed(1)}
              {product.review_count != null && (
                <span className="ml-0.5">({product.review_count})</span>
              )}
            </span>
          )}
          {product.seller_name && (
            <span className="truncate max-w-[120px]">
              {product.seller_name}
              {product.is_verified && " ✓"}
            </span>
          )}
          {product.condition && <span>{product.condition}</span>}
          {product.sales_volume && (
            <span>{product.sales_volume} sold</span>
          )}
        </div>

        {product.product_url && (
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
