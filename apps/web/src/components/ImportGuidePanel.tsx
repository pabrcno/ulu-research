import { useState } from "react";
import { trpc } from "../trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  AlertCircle,
  Loader2,
  AlertTriangle,
  CheckCircle,
  FileText,
  ExternalLink,
  Percent,
  Lock,
  Package,
  Receipt,
  DollarSign,
  ArrowRight,
  Lightbulb,
  Clock,
  Coins,
  TrendingUp,
  Calculator,
} from "lucide-react";
import type { PriceAnalysis, RegulationReport, ImpositiveReport, ImportStep } from "@repo/types";

interface ImportGuidePanelProps {
  hsCode: string;
  productName: string;
  countryCode: string;
  regulatoryFlags: string[];
  importRegulations: string[];
  impositiveRegulations: string[];
  priceAnalysis: PriceAnalysis | null;
  exchangeRate: number;
  localCurrencyCode: string;
  enabled: boolean;
}

export function ImportGuidePanel({
  hsCode,
  productName,
  countryCode,
  regulatoryFlags,
  importRegulations,
  impositiveRegulations,
  priceAnalysis,
  exchangeRate,
  localCurrencyCode,
  enabled,
}: ImportGuidePanelProps) {
  const [activeTab, setActiveTab] = useState("compliance");

  const compliance = trpc.regulations.research.useQuery(
    {
      hs_code: hsCode,
      country_code: countryCode,
      regulatory_flags: regulatoryFlags,
      import_regulations: importRegulations,
      impositive_regulations: impositiveRegulations,
    },
    {
      enabled,
      staleTime: 7 * 24 * 60 * 60 * 1000,
      retry: 2,
    },
  );

  const impositive = trpc.regulations.impositive.useQuery(
    {
      hs_code: hsCode,
      product_name: productName,
      country_code: countryCode,
      impositive_regulations: impositiveRegulations,
      wholesale_floor_usd: priceAnalysis?.wholesale_floor ?? null,
      local_retail_median_usd: priceAnalysis?.local_retail_median ?? null,
      exchange_rate: exchangeRate,
      local_currency_code: localCurrencyCode,
      best_source_platform: priceAnalysis?.best_source_platform ?? null,
    },
    {
      enabled: enabled && !!priceAnalysis,
      staleTime: 7 * 24 * 60 * 60 * 1000,
      retry: 2,
    },
  );

  if (!enabled) return null;

  const isLoading = compliance.isLoading && impositive.isLoading;
  const bothError = compliance.isError && impositive.isError;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Import Guide
        </CardTitle>
        <CardDescription>
          Everything you need to know to import HS {hsCode} into {countryCode}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : bothError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load import guide. Please try again.
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="compliance" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Import Compliance
                {compliance.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </TabsTrigger>
              <TabsTrigger value="taxes" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Taxes & Landed Cost
                {impositive.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="compliance">
              {compliance.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : compliance.isError ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{compliance.error.message}</AlertDescription>
                </Alert>
              ) : compliance.data ? (
                <ComplianceTab data={compliance.data} />
              ) : null}
            </TabsContent>

            <TabsContent value="taxes">
              {!priceAnalysis ? (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Waiting for sourcing data to calculate landed costs...
                  </AlertDescription>
                </Alert>
              ) : impositive.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : impositive.isError ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{impositive.error.message}</AlertDescription>
                </Alert>
              ) : impositive.data ? (
                <TaxesTab data={impositive.data} localCurrency={localCurrencyCode} />
              ) : null}
            </TabsContent>
          </Tabs>
        )}

        <Alert
          variant="default"
          className="mt-6 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
        >
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">Disclaimer</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs leading-relaxed">
            This information is AI-generated from publicly available web sources and should be
            verified with a licensed customs broker before making import decisions.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// ─── Compliance Tab ───────────────────────────────────────────────────

function ComplianceTab({ data }: { data: RegulationReport }) {
  return (
    <div className="space-y-6 mt-4">
      {/* Summary */}
      <p className="text-sm text-foreground leading-relaxed">{data.summary}</p>

      {/* Import Steps Checklist */}
      {data.import_steps && data.import_steps.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            Step-by-Step Import Checklist
          </h3>
          <div className="space-y-3">
            {data.import_steps.map((step) => (
              <ImportStepCard key={step.step_number} step={step} />
            ))}
          </div>
        </div>
      )}

      {/* Required Certifications */}
      {data.required_certifications.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Required Certifications
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.required_certifications.map((cert) => (
              <Badge key={cert} variant="default" className="bg-green-600 hover:bg-green-700">
                {cert}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Prohibited Variants */}
      {data.prohibited_variants.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Prohibited Variants</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {data.prohibited_variants.map((v, i) => (
                <li key={i} className="text-sm">{v}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Labeling Requirements */}
      {data.labeling_requirements.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Labeling & Packaging
          </h3>
          <ul className="space-y-2">
            {data.labeling_requirements.map((req, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Package className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Licensing */}
      {data.licensing_info && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Licensing & Permits
          </h3>
          <p className="text-sm text-muted-foreground">{data.licensing_info}</p>
        </div>
      )}

      {/* Quota */}
      {data.quota_info && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Quota Information</AlertTitle>
          <AlertDescription className="mt-1">{data.quota_info}</AlertDescription>
        </Alert>
      )}

      {/* Sources */}
      <SourcesList sources={data.sources} />
    </div>
  );
}

// ─── Taxes & Landed Cost Tab ──────────────────────────────────────────

function TaxesTab({ data, localCurrency }: { data: ImpositiveReport; localCurrency: string }) {
  const lc = data.landed_cost;
  const hasLandedCost = lc.total_landed_cost_usd != null;
  const effectiveRate =
    lc.total_landed_cost_local != null && lc.total_landed_cost_usd != null && lc.total_landed_cost_usd > 0
      ? lc.total_landed_cost_local / lc.total_landed_cost_usd
      : 1;

  return (
    <div className="space-y-6 mt-4">
      {/* Tax Rate Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TaxRateCard
          label="Import Duty"
          rate={data.import_duty_pct}
          icon={<Percent className="h-4 w-4" />}
          color="text-blue-600"
        />
        <TaxRateCard
          label="VAT / IVA"
          rate={data.vat_rate_pct}
          icon={<Receipt className="h-4 w-4" />}
          color="text-purple-600"
        />
        <TaxRateCard
          label="Total Tax Burden"
          rate={data.total_tax_burden_pct}
          icon={<Coins className="h-4 w-4" />}
          color="text-red-600"
        />
        <TaxRateCard
          label="Net Margin"
          rate={lc.net_margin_pct}
          icon={<TrendingUp className="h-4 w-4" />}
          color={
            lc.net_margin_pct != null && lc.net_margin_pct > 20
              ? "text-green-600"
              : lc.net_margin_pct != null && lc.net_margin_pct > 0
                ? "text-amber-600"
                : "text-red-600"
          }
        />
      </div>

      {/* Tax Summary */}
      <p className="text-sm text-foreground leading-relaxed">{data.tax_summary}</p>

      {/* Landed Cost Waterfall */}
      {hasLandedCost && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Landed Cost Breakdown (per unit)
          </h3>
          <div className="rounded-lg border overflow-hidden">
            <LandedCostRow
              label="Wholesale Price"
              usd={lc.wholesale_unit_price_usd}
              localCurrency={localCurrency}
              exchangeRate={effectiveRate}
              isTotal={false}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <LandedCostRow
              label="+ Estimated Shipping"
              usd={lc.estimated_shipping_per_unit_usd}
              localCurrency={localCurrency}
              exchangeRate={effectiveRate}
              isTotal={false}
              icon={<Package className="h-4 w-4" />}
            />
            <LandedCostRow
              label="= CIF Value"
              usd={lc.cif_value_usd}
              localCurrency={localCurrency}
              exchangeRate={effectiveRate}
              isTotal={false}
              isSubtotal
              icon={<ArrowRight className="h-4 w-4" />}
            />
            <LandedCostRow
              label={`+ Duty (${data.import_duty_pct ?? "?"}%)`}
              usd={lc.duty_amount_usd}
              localCurrency={localCurrency}
              exchangeRate={effectiveRate}
              isTotal={false}
              icon={<Percent className="h-4 w-4" />}
            />
            <LandedCostRow
              label={`+ VAT (${data.vat_rate_pct ?? "?"}%)`}
              usd={lc.vat_amount_usd}
              localCurrency={localCurrency}
              exchangeRate={effectiveRate}
              isTotal={false}
              icon={<Receipt className="h-4 w-4" />}
            />
            {lc.other_fees_usd != null && lc.other_fees_usd > 0 && (
              <LandedCostRow
                label="+ Other Fees"
                usd={lc.other_fees_usd}
                localCurrency={localCurrency}
                exchangeRate={effectiveRate}
                isTotal={false}
                icon={<Coins className="h-4 w-4" />}
              />
            )}
            <LandedCostRow
              label="= Total Landed Cost"
              usd={lc.total_landed_cost_usd}
              localCurrency={localCurrency}
              localAmount={lc.total_landed_cost_local}
              isTotal
              icon={<Calculator className="h-4 w-4" />}
            />
            {lc.local_retail_price_usd != null && (
              <LandedCostRow
                label="Local Retail Price"
                usd={lc.local_retail_price_usd}
                localCurrency={localCurrency}
                exchangeRate={effectiveRate}
                isTotal={false}
                isRetail
                icon={<TrendingUp className="h-4 w-4" />}
              />
            )}
          </div>

          {lc.effective_tax_rate_pct != null && (
            <p className="text-xs text-muted-foreground mt-2">
              Effective tax rate on wholesale price: {lc.effective_tax_rate_pct.toFixed(1)}%
            </p>
          )}
        </div>
      )}

      {/* Additional Taxes */}
      {data.additional_taxes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Additional Taxes & Fees
          </h3>
          <div className="space-y-2">
            {data.additional_taxes.map((tax, i) => (
              <div key={i} className="flex items-start justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{tax.name}</span>
                    {tax.rate_pct != null && (
                      <Badge variant="outline" className="text-xs">
                        {tax.rate_pct}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{tax.description}</p>
                  <p className="text-xs text-muted-foreground">Applies to: {tax.applies_to}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Importer Tips */}
      {data.importer_tips.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Cost-Saving Tips
          </h3>
          <div className="space-y-2">
            {data.importer_tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      <SourcesList sources={data.sources} />
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────

function ImportStepCard({ step }: { step: ImportStep }) {
  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border ${
        step.is_critical
          ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
          : "border-border"
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          step.is_critical
            ? "bg-red-600 text-white"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {step.step_number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium">{step.title}</span>
          {step.is_critical && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0">
              Critical
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
        <div className="flex items-center gap-4 mt-1.5">
          {step.estimated_time && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {step.estimated_time}
            </span>
          )}
          {step.estimated_cost && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              {step.estimated_cost}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TaxRateCard({
  label,
  rate,
  icon,
  color,
}: {
  label: string;
  rate: number | null;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground mb-1 ${color}`}>
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold ${color}`}>
        {rate != null ? `${rate.toFixed(1)}%` : "—"}
      </div>
    </div>
  );
}

function LandedCostRow({
  label,
  usd,
  localCurrency,
  localAmount,
  exchangeRate,
  isTotal,
  isSubtotal,
  isRetail,
  icon,
}: {
  label: string;
  usd: number | null | undefined;
  localCurrency: string;
  localAmount?: number | null;
  exchangeRate?: number;
  isTotal: boolean;
  isSubtotal?: boolean;
  isRetail?: boolean;
  icon: React.ReactNode;
}) {
  const computedLocal = localAmount ?? (usd != null && exchangeRate ? usd * exchangeRate : null);
  const showLocal = localCurrency && localCurrency !== "USD";

  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 ${
        isTotal
          ? "bg-primary/10 font-bold border-t-2 border-primary"
          : isSubtotal
            ? "bg-muted/50 font-medium border-t"
            : isRetail
              ? "bg-green-50 dark:bg-green-950/30 border-t border-dashed"
              : "border-b border-border/50"
      }`}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </div>
      <div className="text-right">
        <span className={`text-sm ${isTotal ? "text-primary" : ""}`}>
          {usd != null ? `$${usd.toFixed(2)}` : "—"}
        </span>
        {showLocal && computedLocal != null && (
          <span className="text-xs text-muted-foreground ml-2">
            ({localCurrency} {computedLocal.toLocaleString(undefined, { maximumFractionDigits: 0 })})
          </span>
        )}
      </div>
    </div>
  );
}

function SourcesList({ sources }: { sources: Array<{ title: string; url: string; domain: string; snippet: string }> }) {
  if (sources.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <ExternalLink className="h-4 w-4" />
        Sources
      </h3>
      <div className="space-y-2">
        {sources.slice(0, 6).map((source, idx) => (
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
  );
}
