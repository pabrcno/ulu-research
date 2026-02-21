import { useEffect } from "react";
import { trpc } from "../trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart3,
  AlertCircle,
  Loader2,
  Users,
  ShoppingCart,
  Lightbulb,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import type { MarketReport } from "@repo/types";

interface MarketReportPanelProps {
  marketTerms: string[];
  countryCode: string;
  enabled: boolean;
  onDataLoaded?: (data: MarketReport) => void;
}

export function MarketReportPanel({
  marketTerms,
  countryCode,
  enabled,
  onDataLoaded,
}: MarketReportPanelProps) {
  const market = trpc.market.research.useQuery(
    { market_terms: marketTerms, country_code: countryCode },
    {
      enabled,
      staleTime: 7 * 24 * 60 * 60 * 1000,
      retry: 2,
    },
  );

  useEffect(() => {
    if (market.data) onDataLoaded?.(market.data);
  }, [market.data]);

  if (!enabled) return null;

  if (market.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Market Research
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (market.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Market Research
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {market.error.message || "Failed to load market data."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!market.data) return null;

  const data = market.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Market Research
            </CardTitle>
            <CardDescription className="mt-1.5">
              Competitive landscape for {countryCode}
            </CardDescription>
          </div>
          <CompetitionBadge level={data.competition_level} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-foreground leading-relaxed">{data.summary}</p>

        <CompetitionMeter level={data.competition_level} />

        {data.top_competitors.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Top Competitors
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.top_competitors.map((competitor, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-lg border bg-card"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-sm">{competitor}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.top_channels.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Best Sales Channels
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_channels.map((channel, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs py-1 px-3">
                  {channel}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {data.positioning_tip && (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <Lightbulb className="h-4 w-4 text-blue-500" />
              Positioning Strategy
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              {data.positioning_tip}
            </p>
          </div>
        )}

        {data.sources.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Sources
            </h3>
            <div className="space-y-2">
              {data.sources.slice(0, 6).map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2.5 rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium line-clamp-1">{source.title}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {source.domain}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{source.snippet}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompetitionBadge({ level }: { level: MarketReport["competition_level"] }) {
  const config = {
    low: { label: "Low Competition", variant: "default" as const, className: "bg-green-500 hover:bg-green-600" },
    medium: { label: "Medium Competition", variant: "secondary" as const, className: "" },
    high: { label: "High Competition", variant: "default" as const, className: "bg-orange-500 hover:bg-orange-600" },
    very_high: { label: "Very High Competition", variant: "destructive" as const, className: "" },
  };
  const { label, variant, className } = config[level];
  return (
    <Badge variant={variant} className={className}>
      <TrendingUp className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

function CompetitionMeter({ level }: { level: MarketReport["competition_level"] }) {
  const pctMap = { low: 25, medium: 50, high: 75, very_high: 95 };
  const colorMap = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-orange-500",
    very_high: "bg-red-500",
  };
  const pct = pctMap[level];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">Competition Intensity</span>
        <span className="text-xs font-medium">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorMap[level]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
