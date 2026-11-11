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
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Incident</TableHead>
          <TableHead>Facility</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Peak</TableHead>
          <TableHead>Duration</TableHead>
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
            <TableCell>{incident.peak_temp_c.toFixed(1)}°C</TableCell>
            <TableCell>{incident.duration_hours}h</TableCell>
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
  );
}
