"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ArrowLeft, CircleAlert, PlugZap, Thermometer, type LucideIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/query-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchIncidentDetail } from "@/lib/api";
import { formatChartTime, formatDateTime } from "@/lib/date";

export default function IncidentDetailPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading incident evidence…" />}>
      <IncidentDetailContent />
    </Suspense>
  );
}

function IncidentDetailContent() {
  const { id } = useParams<{ id: string }>();
  const detail = useQuery({
    queryKey: ["incident-detail", id],
    queryFn: () => fetchIncidentDetail(id),
    enabled: Boolean(id),
  });

  if (detail.isPending) return <LoadingState label="Loading incident evidence…" />;
  if (detail.isError) return <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} />;

  const {
    incident,
    potentially_affected_units: units,
    temperature_history: history,
    power_correlations: outages,
    notice,
    temperature_policy: policy,
  } = detail.data;
  const chartData = history.map((point) => ({
    ...point,
    chart_time: formatChartTime(point.recorded_at),
  }));
  const noticeDetails = notice.replace(/^Investigation candidates only\.\s*/i, "");

  return (
    <>
      <div className="mb-5">
        <Link href="/incidents" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-4" />Back to incidents
        </Link>
      </div>
      <PageHeading
        eyebrow={incident.facility_id}
        title={incident.incident_id}
        description={`${formatDateTime(incident.start_time)} to ${formatDateTime(incident.end_time)} · ${incident.duration_hours} hours`}
        action={
          <Badge
            variant="outline"
            className={incident.severity === "sustained" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}
          >
            {incident.severity}
          </Badge>
        }
      />

      <div role="note" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p><strong>Investigation candidates only.</strong> {noticeDetails} No release, discard, quarantine-removal, compatibility or transfusion action is available here.</p>
      </div>
      <div role="note" className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
        <strong>Facility-level evidence:</strong> temperature records identify a facility, not an individual refrigerator or sensor. This incident cannot be attributed to a specific appliance from the supplied dataset.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EvidenceMetric label="Peak temperature" value={`${incident.peak_temp_c.toFixed(1)}°C`} icon={Thermometer} />
        <EvidenceMetric label="Lowest temperature" value={`${incident.minimum_temp_c.toFixed(1)}°C`} icon={Thermometer} />
        <EvidenceMetric label="Hourly readings" value={incident.reading_count.toLocaleString("en-GB")} icon={CircleAlert} />
        <EvidenceMetric label="Candidate units" value={units.length.toLocaleString("en-GB")} icon={PlugZap} />
      </div>

      <Card className="mt-6 border-0 shadow-sm ring-1 ring-border/80">
        <CardHeader>
          <CardTitle>Temperature history</CardTitle>
          <p className="text-sm text-muted-foreground">Facility readings within six hours either side of the incident window. Sentinel glitches are omitted from the line.</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf3" />
                  <XAxis dataKey="chart_time" tickLine={false} axisLine={false} minTickGap={30} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} unit="°C" />
                  <Tooltip labelFormatter={(label) => String(label)} formatter={(value) => [typeof value === "number" ? `${value.toFixed(1)}°C` : value, "Temperature"]} />
                  <ReferenceLine y={policy.minimum_c} stroke="#38a169" strokeDasharray="5 5" />
                  <ReferenceLine y={policy.maximum_c} stroke="#d97706" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="temp_c" name="Temperature" stroke="#2864b4" strokeWidth={2.5} dot={{ r: 2.5, fill: "#2864b4" }} activeDot={{ r: 5 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No timestamped readings are available around this incident.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader>
            <CardTitle>Power outage correlation</CardTitle>
            <p className="text-sm text-muted-foreground">Correlated outage records are context, not proof of cause.</p>
          </CardHeader>
          <CardContent className="p-0">
            {outages.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Outage</TableHead><TableHead>Overlap</TableHead><TableHead>Backup power</TableHead></TableRow></TableHeader>
                <TableBody>{outages.map((outage) => (
                  <TableRow key={outage.outage_id}>
                    <TableCell className="font-medium">{outage.outage_id}</TableCell>
                    <TableCell>{outage.overlap_minutes.toLocaleString("en-GB")} min</TableCell>
                    <TableCell>{String(outage.backup_power_engaged)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <p className="px-5 pb-5 text-sm text-muted-foreground">No overlapping power-outage record was found for this incident.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader>
            <CardTitle>Potentially affected units</CardTitle>
            <p className="text-sm text-muted-foreground">Each listed unit is an investigation candidate and requires qualified review.</p>
          </CardHeader>
          <CardContent className="p-0">
            {units.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Unit</TableHead><TableHead>Component</TableHead><TableHead>Blood group</TableHead></TableRow></TableHeader>
                <TableBody>{units.map((unit) => (
                  <TableRow key={unit.unit_id}>
                    <TableCell className="font-medium">{unit.unit_id}</TableCell>
                    <TableCell>{unit.component}</TableCell>
                    <TableCell>{unit.blood_group}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <p className="px-5 pb-5 text-sm text-muted-foreground">No candidate units were returned for this incident.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="mt-5 text-xs leading-5 text-muted-foreground">{incident.sustained_rule}</p>
    </>
  );
}

function EvidenceMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/80">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
