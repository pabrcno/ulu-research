import { useState, useEffect } from "react";
import { trpc } from "../trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertCircle, 
  Loader2,
  ArrowUp,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDown,
  Calendar,
  MapPin,
  Search,
  Sparkles,
  Languages,
  Globe
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import type { TrendReport } from "@repo/types";

interface TrendsPanelProps {
  trendKeywords: string[];
  countryCode: string;
  enabled: boolean;
  onDataLoaded?: (data: TrendReport) => void;
}

export function TrendsPanel({ trendKeywords, countryCode, enabled, onDataLoaded }: TrendsPanelProps) {
  const [useRegionalLanguage, setUseRegionalLanguage] = useState(false);

  const trends = trpc.trends.get.useQuery(
    { 
      trend_keywords: trendKeywords, 
      geo: countryCode,
      use_regional_language: useRegionalLanguage,
    },
    { 
      enabled,
      staleTime: 24 * 60 * 60 * 1000,
      retry: 2,
    }
  );

  useEffect(() => {
    if (trends.data) onDataLoaded?.(trends.data);
  }, [trends.data]);

  if (!enabled) return null;

  if (trends.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Google Trends Analysis
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

  if (trends.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Google Trends Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {trends.error.message || "Failed to load trends data. Please try again."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!trends.data) return null;

  const data = trends.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Google Trends Analysis
            </CardTitle>
            <CardDescription className="mt-1.5 flex items-center gap-2">
              <span>12-month trend data for "{data.keyword}" in {data.geo}</span>
              {data.translated_keyword && data.original_keyword && (
                <Badge variant="secondary" className="text-xs">
                  <Languages className="h-3 w-3 mr-1" />
                  {data.language_name}
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle
              useRegionalLanguage={useRegionalLanguage}
              onToggle={setUseRegionalLanguage}
              languageName={data.language_name}
              isLoading={trends.isFetching}
            />
            <TrendDirectionBadge direction={data.trend_direction} />
            <div className="text-right">
              <div className="text-2xl font-bold">{data.trend_score}</div>
              <div className="text-xs text-muted-foreground">Trend Score</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Translation Info */}
        {data.translated_keyword && data.original_keyword && (
          <Alert>
            <Languages className="h-4 w-4" />
            <AlertDescription>
              Searching in <strong>{data.language_name}</strong>: "{data.original_keyword}" → "{data.translated_keyword}"
            </AlertDescription>
          </Alert>
        )}
        {/* Seasonality & Peak Month */}
        {data.is_seasonal && data.peak_month && (
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              <strong>Seasonal product</strong> — Peak demand in <strong>{data.peak_month}</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Timeseries Chart */}
        {data.timeseries.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Interest Over Time (12 months)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.timeseries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="week_start" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Interest (0-100)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                />
                <Tooltip 
                  labelFormatter={(value) => {
                    const date = new Date(value as string);
                    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  }}
                  formatter={(value: number) => [value, 'Interest']}
                />
                <Line 
                  type="monotone" 
                  dataKey="interest_value" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                  name="Interest"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Regional Hotspots */}
        {data.regions.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Top Regions by Interest
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.regions.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis 
                  type="category" 
                  dataKey="region_name" 
                  tick={{ fontSize: 12 }}
                  width={100}
                />
                <Tooltip formatter={(value: number) => [value, 'Interest']} />
                <Bar 
                  dataKey="interest_value" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                  name="Interest"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Rising Queries */}
        {data.rising_queries.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Rising Search Queries
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.rising_queries.slice(0, 8).map((query, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-md border bg-card text-card-foreground"
                >
                  <span className="text-sm">{query.query_text}</span>
                  <Badge variant={query.type === "rising" ? "default" : "secondary"} className="text-xs">
                    {query.value}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rising Topics */}
        {data.rising_topics.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Rising Topics
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.rising_topics.slice(0, 10).map((topic, idx) => (
                <Badge 
                  key={idx} 
                  variant={topic.type === "rising" ? "default" : "outline"}
                  className="text-xs"
                >
                  {topic.topic_title} {topic.value && `(${topic.value})`}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LanguageToggle({
  useRegionalLanguage,
  onToggle,
  languageName,
  isLoading,
}: {
  useRegionalLanguage: boolean;
  onToggle: (value: boolean) => void;
  languageName?: string;
  isLoading: boolean;
}) {
  const regionalLang = languageName && languageName !== "English" ? languageName : null;

  if (!regionalLang) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 border rounded-md p-1">
      <Button
        variant={!useRegionalLanguage ? "default" : "ghost"}
        size="sm"
        onClick={() => onToggle(false)}
        disabled={isLoading}
        className="h-7 text-xs"
      >
        <Globe className="h-3 w-3 mr-1" />
        English
      </Button>
      <Button
        variant={useRegionalLanguage ? "default" : "ghost"}
        size="sm"
        onClick={() => onToggle(true)}
        disabled={isLoading}
        className="h-7 text-xs"
      >
        <Languages className="h-3 w-3 mr-1" />
        {regionalLang}
      </Button>
    </div>
  );
}

function TrendDirectionBadge({ direction }: { direction: TrendReport["trend_direction"] }) {
  const config = {
    up: { 
      icon: ArrowUp, 
      label: "Strong Growth", 
      variant: "default" as const,
      className: "bg-green-500 hover:bg-green-600"
    },
    up_right: { 
      icon: ArrowUpRight, 
      label: "Growing", 
      variant: "default" as const,
      className: "bg-green-400 hover:bg-green-500"
    },
    flat: { 
      icon: Minus, 
      label: "Stable", 
      variant: "secondary" as const,
      className: ""
    },
    down_right: { 
      icon: ArrowDownRight, 
      label: "Declining", 
      variant: "outline" as const,
      className: "border-orange-500 text-orange-500"
    },
    down: { 
      icon: ArrowDown, 
      label: "Strong Decline", 
      variant: "destructive" as const,
      className: ""
    },
  };

  const { icon: Icon, label, variant, className } = config[direction];

  return (
    <Badge variant={variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}
