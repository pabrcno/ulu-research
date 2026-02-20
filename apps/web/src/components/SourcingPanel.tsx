import { useState } from "react";
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
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PlatformProduct, Platform, SourcingSearchResponse } from "@repo/types";

const PLATFORM_LABELS: Record<Platform, string> = {
  alibaba: "Alibaba",
  amazon: "Amazon",
  ebay: "eBay",
  walmart: "Walmart",
  google_shopping: "Google Shopping",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  alibaba: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  amazon: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ebay: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  walmart: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  google_shopping: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

interface SourcingPanelProps {
  normalizedQuery: string;
  enabled: boolean;
}

export function SourcingPanel({ normalizedQuery, enabled }: SourcingPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("summary");

  const sourcing = trpc.sourcing.search.useQuery(
    { normalized_query: normalizedQuery },
    { enabled, staleTime: 60 * 60 * 1000, retry: 1 },
  );

  if (!enabled) return null;

  if (sourcing.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-3" />
          <span className="text-muted-foreground">
            Searching 5 platforms in parallel...
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

  const { platforms, price_analysis } = sourcing.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingCart className="h-5 w-5" />
          Product Sourcing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PriceSummaryBar analysis={price_analysis} />

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
              <PlatformProductGrid products={platforms[p]} platform={p} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function PriceSummaryBar({ analysis }: { analysis: SourcingSearchResponse["price_analysis"] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <SummaryCell
        label="Wholesale Floor"
        value={analysis.wholesale_floor != null ? `$${analysis.wholesale_floor.toFixed(2)}` : "N/A"}
        icon={<TrendingDown className="h-4 w-4 text-green-600" />}
      />
      <SummaryCell
        label="Retail Ceiling"
        value={analysis.retail_ceiling != null ? `$${analysis.retail_ceiling.toFixed(2)}` : "N/A"}
        icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
      />
      <SummaryCell
        label="Margin Range"
        value={
          analysis.gross_margin_pct_min != null && analysis.gross_margin_pct_max != null
            ? `${analysis.gross_margin_pct_min.toFixed(0)}%–${analysis.gross_margin_pct_max.toFixed(0)}%`
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
}: {
  products: PlatformProduct[];
  platform: Platform;
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
        <ProductCard key={product.external_id ?? idx} product={product} />
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: PlatformProduct }) {
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
          <span className="text-sm font-bold">{product.price_formatted}</span>
          {product.price_type && (
            <Badge
              variant="outline"
              className={`text-xs ${PLATFORM_COLORS[product.platform]}`}
            >
              {product.price_type}
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
