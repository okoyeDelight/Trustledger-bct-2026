import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Incident } from "@/lib/types";
import { formatDateTime } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function IncidentTable({ incidents }: { incidents: Incident[] }) {
  if (!incidents.length) {
    return (
      <div className="px-5 py-12 text-center text-sm text-muted-foreground">
        No incidents match this search.
      </div>
    );
  }

  return (
    <>
      <div className="divide-y md:hidden">
        {incidents.map(incident => (
          <Link
            key={incident.incident_id}
            href={`/incidents/${encodeURIComponent(incident.incident_id)}`}
            className="block space-y-2 px-4 py-4 transition-colors hover:bg-muted/40"
            aria-label={`Open incident ${incident.incident_id}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {incident.source_type === "external_observation" ? "ABBIS / Connected source" :
                  incident.source_type === "staff_report" ? "Worker report" : "Historical research"}
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
            </div>
            <p className="break-all text-sm font-semibold text-primary">{incident.incident_id}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Facility</span><p className="font-medium">{incident.facility_id}</p></div>
              <div><span className="text-muted-foreground">Source readings</span><p className="font-medium">{incident.reading_count ?? "Worker reported"}</p></div>
              <div><span className="text-muted-foreground">Start</span><p className="font-medium">{formatDateTime(incident.start_time)}</p></div>
              <div><span className="text-muted-foreground">Peak recorded</span><p className="font-medium">{typeof incident.peak_temp_c === "number" ? incident.peak_temp_c.toFixed(1) + "°C" : "Not measured"}</p></div>
              <div><span className="text-muted-foreground">Observation span</span><p className="font-medium">{typeof incident.observation_span_hours === "number" ? incident.observation_span_hours + "h" : "Not established"}</p></div>
            </div>
            <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium">{incident.severity.replaceAll("_"," ")}</span>
          </Link>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Incident</TableHead>
          <TableHead>Facility</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Peak</TableHead>
          <TableHead>Observed span</TableHead>
          <TableHead>Classification</TableHead>
          <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {incidents.map((incident) => (
          <TableRow key={incident.incident_id}>
            <TableCell className="font-medium">
              <Link
                className="text-primary hover:underline"
                href={`/incidents/${encodeURIComponent(incident.incident_id)}`}
              >
                {incident.incident_id}
              </Link>
            </TableCell>
            <TableCell>{incident.facility_id}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateTime(incident.start_time)}
            </TableCell>
            <TableCell>{typeof incident.peak_temp_c === "number" ? incident.peak_temp_c.toFixed(1) + "°C" : "Not measured"}</TableCell>
            <TableCell>{incident.source_type === "external_observation" && typeof incident.observation_span_hours === "number"
              ? incident.observation_span_hours + "h (" + incident.reading_count + " readings)"
              : typeof incident.duration_hours === "number" ? incident.duration_hours + "h"
              : "Not established"}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  incident.severity === "sustained"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }
              >
                {incident.severity}
              </Badge>
            </TableCell>
            <TableCell>
              <Link
                aria-label={`View ${incident.incident_id}`}
                href={`/incidents/${encodeURIComponent(incident.incident_id)}`}
                className="text-muted-foreground hover:text-primary"
              >
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
      </div>
    </>
  );
}
