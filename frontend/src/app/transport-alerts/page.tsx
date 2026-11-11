"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Truck } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/query-states";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchTransportAlerts } from "@/lib/api";
import { formatDateTime } from "@/lib/date";

const PAGE_SIZE = 50;

export default function TransportAlertsPage() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const alerts = useQuery({
    queryKey: ["transport-alerts", search, offset],
    queryFn: () => fetchTransportAlerts(PAGE_SIZE, offset, search),
  });
  const totalPages = alerts.data ? Math.max(1, Math.ceil(alerts.data.total / PAGE_SIZE)) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <PageHeading
        eyebrow="Cold chain in transit"
        title="Transport temperature alerts"
        description="Review recorded cool-box maximum temperatures for RBC and whole-blood transfers separately from facility refrigerator incidents."
      />
      <div role="note" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <strong>Investigation evidence only.</strong>{" "}
        The dataset records a maximum temperature for each transfer, not a continuous temperature history. An above-threshold maximum does not establish exposure duration, prove a unit is unsafe, or authorize a disposition decision.
      </div>
      <Card className="border-0 shadow-sm ring-1 ring-border/80">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:px-5">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOffset(0);
                }}
                placeholder="Search transfer, unit, facility…"
                aria-label="Search transport temperature alerts"
                className="pl-9"
              />
            </div>
            {alerts.data && <p className="text-sm text-muted-foreground">{alerts.data.total.toLocaleString("en-GB")} alerts</p>}
          </div>
          {alerts.isPending && <LoadingState label="Loading transport temperature evidence…" />}
          {alerts.isError && <div className="p-5"><ErrorState message={alerts.error.message} onRetry={() => void alerts.refetch()} /></div>}
          {alerts.data && (
            <>
              {alerts.data.items.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transfer</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Recorded status</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Dispatched</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Cool-box max</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.data.items.map((alert) => (
                      <TableRow key={alert.transfer_id}>
                        <TableCell className="font-medium">{alert.transfer_id}</TableCell>
                        <TableCell>{alert.unit_id}<span className="ml-1 text-xs text-muted-foreground">({alert.component}, {alert.blood_group})</span></TableCell>
                        <TableCell className="capitalize">{alert.unit_status.replaceAll("_", " ")}</TableCell>
                        <TableCell>{alert.from_facility_id} → {alert.to_facility_id}</TableCell>
                        <TableCell>{alert.dispatched_at ? formatDateTime(alert.dispatched_at) : "Not recorded"}</TableCell>
                        <TableCell>{alert.received_at ? formatDateTime(alert.received_at) : "Not confirmed"}</TableCell>
                        <TableCell className="capitalize">{alert.transport_mode.replaceAll("_", " ")}</TableCell>
                        <TableCell className="font-semibold text-amber-800">{alert.coolbox_max_temp_c.toFixed(1)}°C</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">No transport alerts match this search.</p>
              )}
              {alerts.data.total > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t px-4 py-3 sm:px-5">
                  <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= alerts.data.total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-muted-foreground">
        <Truck className="size-4 shrink-0" aria-hidden="true" />
        This list uses the configured RBC/WB upper-temperature threshold; it is not combined with facility sensor incidents.
      </p>
    </>
  );
}
