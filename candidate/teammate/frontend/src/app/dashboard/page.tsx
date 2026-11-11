"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  ArrowRight,
  ChartNoAxesCombined,
  ClipboardList,
  PackageCheck,
  Thermometer,
} from "lucide-react";
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
import { IncidentTable } from "@/components/incident-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDashboard, fetchIncidents } from "@/lib/api";
import { formatDateTime } from "@/lib/date";

export default function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });
  const latestOffset = Math.max(0, (dashboard.data?.incident_count ?? 8) - 8);
  const recent = useQuery({
    queryKey: ["latest-incidents", latestOffset],
    queryFn: () => fetchIncidents(8, latestOffset),
    enabled: dashboard.isSuccess,
  });

  if (dashboard.isPending)
    return <LoadingState label="Loading the live dashboard…" />;
  if (dashboard.isError) {
    return (
      <ErrorState
        message={dashboard.error.message}
        onRetry={() => void dashboard.refetch()}
      />
    );
  }
  const data = dashboard.data;

  return (
    <>
      <PageHeading
        eyebrow="Cold-chain overview"
        title="Monitoring overview"
        description="A live view of temperature incidents, facility monitoring and dataset quality."
      />

      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm leading-6 text-blue-950">
        <span className="font-semibold">Investigation support only.</span>{" "}
        {data.safety_note}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Detected incidents"
          value={data.incident_count}
          note={`${data.sustained_incident_count.toLocaleString()} sustained`}
          icon={AlertOctagon}
          tone="red"
        />
        <MetricCard
          label="Investigation candidates"
          value={data.unique_potentially_affected_units}
          note="Unique RBC/WB units"
          icon={PackageCheck}
          tone="amber"
        />
        <MetricCard
          label="Out-of-range readings"
          value={data.temperature_quality.out_of_range_readings}
          note={`Outside the configured ${data.temperature_policy.minimum_c}–${data.temperature_policy.maximum_c}°C band`}
          icon={Thermometer}
          tone="blue"
        />
        <MetricCard
          label="Estimated missing readings"
          value={data.temperature_quality.estimated_missing_hourly_readings}
          note="Estimated hourly observations"
          icon={ClipboardList}
          tone="green"
        />
      </div>

      {data.feature_evaluation.available &&
        data.feature_evaluation.feature &&
        data.feature_evaluation.baseline && (
          <Card className="mt-6 border-0 shadow-sm ring-1 ring-border/80">
            <CardHeader>
              <CardTitle>Data feature vs simple baseline</CardTitle>
              <p className="text-sm text-muted-foreground">
                Retrospective unit-matching evaluation ·{" "}
                {data.feature_evaluation.population_units?.toLocaleString()}{" "}
                units
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  {
                    label: "TrustLedger feature",
                    name: data.feature_evaluation.feature_name,
                    metrics: data.feature_evaluation.feature,
                  },
                  {
                    label: "Simple baseline",
                    name: data.feature_evaluation.baseline_name,
                    metrics: data.feature_evaluation.baseline,
                  },
                ].map(({ label, name, metrics }) => (
                  <div key={label} className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-medium">{name}</p>
                    <p className="mt-4 text-2xl font-semibold tabular-nums">
                      {metrics.candidate_units.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      unique candidate units
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <p>
                        Precision{" "}
                        <strong className="tabular-nums">
                          {(metrics.precision * 100).toFixed(1)}%
                        </strong>
                      </p>
                      <p>
                        Recall{" "}
                        <strong className="tabular-nums">
                          {(metrics.recall * 100).toFixed(1)}%
                        </strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
                {data.feature_evaluation.note} The feature returns fewer
                candidates and has higher measured precision on this dataset,
                with lower recall than the baseline. This is not a probability
                or a guarantee for another site.
              </p>
            </CardContent>
          </Card>
        )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
        <Card className="border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader className="pb-0">
            <CardTitle>Incident trends</CardTitle>
            <p className="text-sm text-muted-foreground">
              Monthly counts from the processed incident dataset
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[280px] w-full">
              {data.incident_trends.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.incident_trends}
                    margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e8edf3"
                    />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="warning_count"
                      name="Warnings"
                      stackId="incidents"
                      fill="#f3b84b"
                    />
                    <Bar
                      dataKey="sustained_count"
                      name="Sustained"
                      stackId="incidents"
                      fill="#e06b70"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No incident trend data is available.
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <i className="size-2 rounded-full bg-amber-400" />
                Warning
              </span>
              <span className="flex items-center gap-2">
                <i className="size-2 rounded-full bg-rose-400" />
                Sustained
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Facility monitoring</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Facilities ranked by sustained incidents
                </p>
              </div>
              <ChartNoAxesCombined
                className="size-5 text-primary"
                aria-hidden="true"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.facility_monitoring.slice(0, 6).map((facility) => (
              <div
                key={facility.facility_id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{facility.facility_id}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {facility.latest_incident_at
                      ? `Latest flag ${formatDateTime(facility.latest_incident_at)}`
                      : "No timestamp available"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {facility.sustained_count}
                  </p>
                  <p className="text-[11px] text-muted-foreground">sustained</p>
                </div>
              </div>
            ))}
            {!data.facility_monitoring.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No facility data is available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-0 shadow-sm ring-1 ring-border/80">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Latest incidents</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Most recent records from the processed dataset
            </p>
          </div>
          <Link
            href="/incidents"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            All incidents <ArrowRight className="size-4" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recent.isPending && (
            <LoadingState label="Loading latest incidents…" />
          )}
          {recent.isError && (
            <div className="p-5">
              <ErrorState
                message={recent.error.message}
                onRetry={() => void recent.refetch()}
              />
            </div>
          )}
          {recent.data && <IncidentTable incidents={recent.data.items} />}
        </CardContent>
      </Card>

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        {data.dataset_note}
      </p>
    </>
  );
}
