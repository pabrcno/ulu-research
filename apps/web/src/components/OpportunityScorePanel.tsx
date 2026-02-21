import { useEffect, useRef } from "react";
import { trpc } from "../trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Target,
  AlertCircle,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ShoppingBag,
  Search,
  Package,
  Percent,
} from "lucide-react";

interface OpportunityScorePanelProps {
  sessionId: string;
  allReady: boolean;
}

export function OpportunityScorePanel({
  sessionId,
  allReady,
}: OpportunityScorePanelProps) {
  const synthesize = trpc.opportunity.synthesize.useMutation();
  const triggered = useRef(false);

  useEffect(() => {
    if (allReady && !triggered.current && !synthesize.isPending && !synthesize.data) {
      triggered.current = true;
      synthesize.mutate({ session_id: sessionId });
    }
  }, [allReady, sessionId]);

  if (!allReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Opportunity Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Waiting for all research modules to complete before synthesizing opportunity score...
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (synthesize.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Opportunity Assessment
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

  if (synthesize.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Opportunity Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {synthesize.error.message || "Failed to generate opportunity assessment."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!synthesize.data) return null;

  const data = synthesize.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Opportunity Assessment
        </CardTitle>
        <CardDescription>
          Cross-signal synthesis of pricing, trends, regulations, and market data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={data.opportunity_score} />
          <div className="grid grid-cols-2 gap-4 flex-1">
            {data.estimated_margin_pct != null && (
              <MetricCard
                icon={<Percent className="h-4 w-4" />}
                label="Est. Net Margin"
                value={`${data.estimated_margin_pct.toFixed(1)}%`}
                color={
                  data.estimated_margin_pct > 20
                    ? "text-green-600"
                    : data.estimated_margin_pct > 0
                      ? "text-amber-600"
                      : "text-red-600"
                }
              />
            )}
            {data.best_source_platform && (
              <MetricCard
                icon={<ShoppingBag className="h-4 w-4" />}
                label="Best Source"
                value={formatPlatform(data.best_source_platform)}
              />
            )}
            {data.best_launch_month && (
              <MetricCard
                icon={<Calendar className="h-4 w-4" />}
                label="Best Launch"
                value={data.best_launch_month}
              />
            )}
            <MetricCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Score"
              value={`${data.opportunity_score}/100`}
              color={scoreColor(data.opportunity_score)}
            />
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted/50 border">
          <p className="text-sm leading-relaxed">{data.overall_verdict}</p>
        </div>

        {data.risk_flags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risk Flags
            </h3>
            <div className="space-y-2">
              {data.risk_flags.map((flag, idx) => (
                <Alert key={idx} variant="destructive" className="py-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{flag}</AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {data.keyword_gaps.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Keyword & Niche Gaps
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.keyword_gaps.map((kw, idx) => (
                <Badge key={idx} variant="default" className="text-xs py-1 px-3">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {data.variant_suggestions.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Variant & Bundle Suggestions
            </h3>
            <div className="space-y-2">
              {data.variant_suggestions.map((variant, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm p-2.5 rounded-lg border bg-card">
                  <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{variant}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);
  const strokeColor = scoreStrokeColor(score);

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
        <circle
          cx="64"
          cy="64"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        <circle
          cx="64"
          cy="64"
          r="54"
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold ${color ?? ""}`}>{value}</div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-amber-600";
  if (score >= 20) return "text-orange-600";
  return "text-red-600";
}

function scoreStrokeColor(score: number): string {
  if (score >= 80) return "hsl(142, 71%, 45%)";
  if (score >= 60) return "hsl(217, 91%, 60%)";
  if (score >= 40) return "hsl(45, 93%, 47%)";
  if (score >= 20) return "hsl(24, 95%, 53%)";
  return "hsl(0, 84%, 60%)";
}

function formatPlatform(platform: string): string {
  const names: Record<string, string> = {
    aliexpress: "AliExpress",
    wholesale: "Wholesale",
    amazon: "Amazon",
    ebay: "eBay",
    walmart: "Walmart",
    google_shopping: "Google Shopping",
    local_retail: "Local Retail",
  };
  return names[platform] ?? platform;
}
