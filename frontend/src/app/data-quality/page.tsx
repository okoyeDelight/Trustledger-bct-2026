"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CircleHelp, Database, Thermometer, type LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ErrorState, LoadingState } from "@/components/query-states";
import { MetricCard } from "@/components/metric-card";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDataQuality, fetchSiteConfig } from "@/lib/api";

export default function DataQualityPage() {
  const quality = useQuery({
    queryKey: ["data-quality"],
    queryFn: fetchDataQuality,
  });
  const config = useQuery({
    queryKey: ["site-config"],
    queryFn: fetchSiteConfig,
  });
  if (quality.isPending) return <LoadingState label="Loading data-quality metrics…" />;
  if (quality.isError) return <ErrorState message={quality.error.message} onRetry={() => void quality.refetch()} />;
  if (config.isPending) return <LoadingState label="Loading configured temperature policy…" />;
  if (config.isError) return <ErrorState message={config.error.message} onRetry={() => void config.refetch()} />;

  const data = quality.data;
  const chartData = [
    { name: "Sensor glitches", value: data.known_sensor_glitch_rows },
    { name: "Missing values", value: data.missing_temperature_or_timestamp_rows },
    { name: "Missing hours est.", value: data.estimated_missing_hourly_readings },
    { name: "Out of range", value: data.out_of_range_readings },
    { name: "Duplicate rows", value: data.duplicate_rows },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Data integrity"
        title="Data quality"
        description="Sensor glitches, missing observations and validation indicators calculated by the processing pipeline."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Raw readings" value={data.raw_rows} note="Records ingested" icon={Database} />
        <MetricCard label="Usable readings" value={data.usable_rows} note="After validity filters" icon={Activity} tone="green" />
        <MetricCard label="Known sensor glitches" value={data.known_sensor_glitch_rows} note="Sentinel values excluded" icon={AlertTriangle} tone="amber" />
        <MetricCard label="Estimated missing hours" value={data.estimated_missing_hourly_readings} note="Based on hourly coverage" icon={CircleHelp} tone="red" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <Card className="border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader>
            <CardTitle>Validation indicators</CardTitle>
            <p className="text-sm text-muted-foreground">Counts for the complete processed dataset; missing-hour values are estimates.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf3" />
                  <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={55} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Count" fill="#4778bd" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader>
            <CardTitle>Validation summary</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configured cold-chain limits: {config.data.temperature_policy.minimum_c}–{config.data.temperature_policy.maximum_c}°C
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <QualityRow icon={Thermometer} label={`Above ${config.data.temperature_policy.maximum_c}°C`} value={data.above_range_readings} />
            <QualityRow icon={Thermometer} label={`Below ${config.data.temperature_policy.minimum_c}°C`} value={data.below_range_readings} />
            <QualityRow icon={AlertTriangle} label="Conflicting duplicate timestamps" value={data.conflicting_duplicate_timestamps} />
            <QualityRow icon={Database} label="Duplicate rows" value={data.duplicate_rows} />
            <div className="rounded-lg bg-muted/70 p-3 text-xs leading-5 text-muted-foreground">
              Sentinel values 0.0, -99.0 and 99.9 are classified as sensor glitches, not real excursions. Missing hourly counts are estimates, not observed missing records.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function QualityRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </div>
      <span className="font-semibold tabular-nums">{value.toLocaleString("en-GB")}</span>
    </div>
  );
}
