"use client";

import type { IncidentDetail, InvestigationNote, CaseWorkflow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/date";
import { Database, FileCheck2, HelpCircle, ShieldCheck } from "lucide-react";

interface Props {
  detail: IncidentDetail;
  notes: InvestigationNote[];
  workflow?: CaseWorkflow;
}

export function EvidencePassport({ detail, notes, workflow }: Props) {
  const { incident, temperature_history: readings, potentially_affected_units: units, power_correlations: outages } = detail;
  const manual = incident.source_type === "staff_report";
  const evidenceSource = manual ? "Authenticated staff report" : "Pinned organizer synthetic CSV: temperature_logs.csv";
  const invalid = readings.filter((r) => r.quality_status !== "valid").length;
  const observed = readings.filter((r) => r.quality_status === "valid").length;
  const events = workflow?.events ?? [];

  return (
    <section aria-label="Evidence passport" className="mt-5">
      <Card className="border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-800">
              <FileCheck2 className="size-4" /> Evidence Passport
            </div>
            <Badge variant="outline" className="border-sky-200 text-sky-800">Synthetic · Investigation only</Badge>
          </div>
          <CardTitle className="text-xl">What do we actually know?</CardTitle>
          <p className="text-sm text-slate-600">A traceable explanation of source evidence, uncertainty and human action — not a clinical clearance certificate.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PassportItem icon={Database} title="Source" value={evidenceSource} note={manual ? "Observation not corroborated by a device" : "Facility-level time series; no device identity"} />
            <PassportItem icon={FileCheck2} title="Observed" value={manual ? "Staff-reported observation" : `${observed} usable samples in this incident context`} note={manual ? "No automatically measured exposure" : `${invalid} excluded or flagged readings`} />
            <PassportItem icon={HelpCircle} title="Unknown" value="Fridge-level exposure not established" note={`${units.length} unit-matching candidate(s), not confirmed affected units`} />
            <PassportItem icon={ShieldCheck} title="Accountability" value={workflow ? workflow.status.replaceAll("_", " ") : "Loading case status"} note={`${notes.length} worker finding(s) · ${events.length} logged action(s)`} />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <strong>Evidence boundary:</strong> No records here establish a specific refrigerator, confirmed blood-unit exposure, or product safety. {outages.length > 0 ? `${outages.length} outage overlap(s) provide context, not a proven cause.` : "No overlapping outage record was returned; this does not establish safety."}
          </div>

          <details className="group rounded-lg border bg-white px-4 py-3">
            <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">Inspect underlying records and handoffs</summary>
            <div className="mt-3 space-y-4 border-t pt-3 text-sm">
              <p><strong>Case:</strong> {incident.incident_id} · <strong>Facility:</strong> {incident.facility_id}</p>
              <p><strong>Source type:</strong> {evidenceSource}</p>
              {manual ? <p>Original description: {incident.report_description ?? "Not provided"}</p> : (
                <>
                  <p><strong>Incident interval:</strong> {formatDateTime(incident.start_time)} to {formatDateTime(incident.end_time)}</p>
                  <p><strong>Detection rule:</strong> {incident.sustained_rule}</p>
                  <div className="max-h-48 overflow-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Timestamp</th><th className="p-2">Temperature</th><th className="p-2">Quality</th></tr></thead>
                      <tbody>{readings.slice(0,30).map((r, i) => (
                        <tr key={r.recorded_at + i} className="border-t">
                          <td className="p-2">{r.recorded_at}</td>
                          <td className="p-2">{r.temp_c === null ? "Excluded" : r.temp_c.toFixed(1) + "°C"}</td>
                          <td className="p-2">{r.quality_status}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  {readings.length > 30 && <p className="text-xs text-slate-500">Showing the first 30 of {readings.length} contextual readings; the temperature chart below uses the full returned series.</p>}
                </>
              )}
              <p className="font-semibold">Recorded human actions</p>
              {events.length ? (
                <ol className="space-y-2">
                  {events.map((event) => (
                    <li key={event.id} className="rounded-lg bg-slate-50 p-3">
                      <strong>{event.event_kind.replaceAll("_", " ")}</strong> · {event.actor_name} ({event.actor_role.replaceAll("_", " ")}) · {formatDateTime(event.created_at)}
                    </li>
                  ))}
                </ol>
              ) : <p>No submitted case transitions recorded yet; this is not an approval.</p>}
            </div>
          </details>
        </CardContent>
      </Card>
    </section>
  );
}

function PassportItem({icon: Icon,title,value,note}: {
  icon: typeof Database;
  title: string;
  value: string;
  note: string;
}) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3">
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <Icon className="size-4" />{title}
    </div>
    <p className="text-sm font-semibold leading-snug text-slate-900">{value}</p>
    <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>
  </div>;
}
