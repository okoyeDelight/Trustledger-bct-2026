"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Search, Cable, Radio, RefreshCw } from "lucide-react";
import { IncidentTable } from "@/components/incident-table";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchIncidents, fetchReceivedObservations } from "@/lib/api";
import { formatDateTime } from "@/lib/date";

const PAGE_SIZE = 50;

/**
 * The operational queue is fed ONLY by actual incoming connector cases and
 * explicit staff reports. The historical organizer CSV incident batch is
 * available to the offline analysis pipeline, never shown as live work.
 */
export default function IncidentsPage() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const incidents = useQuery({
    queryKey: ["incidents", search, offset, "active"],
    queryFn: () => fetchIncidents(PAGE_SIZE, offset, search, "active"),
    refetchInterval: 10000,
  });
  const receipts = useQuery({
    queryKey: ["received-source-observations"],
    queryFn: fetchReceivedObservations,
    refetchInterval: 10000,
  });
  const totalPages = incidents.data ? Math.max(1, Math.ceil(incidents.data.total / PAGE_SIZE)) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <PageHeading
        eyebrow="Connected blood-bank workflow"
        title="Incoming incidents"
        description="Cases appear here only when a connected source triggers an investigation or a worker reports an observation. Nothing is preloaded into this queue from the historical dataset."
      />
      <Card className="mb-5 border-0 shadow-sm ring-1 ring-border/80">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <Radio className="size-4 text-emerald-600" aria-hidden="true" />
                Received from connected systems
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Individual readings received by TrustLedger, independently of incident creation. Refreshes every 10 seconds.
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={receipts.isFetching}
              onClick={() => { void receipts.refetch(); void incidents.refetch(); }}>
              <RefreshCw className="mr-2 size-3.5" aria-hidden="true" />
              Refresh
            </Button>
          </div>
          {receipts.isPending && <p className="mt-4 text-sm text-muted-foreground">Checking connector receipts…</p>}
          {receipts.isError && <p role="alert" className="mt-4 text-sm text-destructive">Cannot load source receipts: {receipts.error.message}</p>}
          {receipts.data && <>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <p className="text-3xl font-bold tabular-nums">{receipts.data.total.toLocaleString("en-GB")}</p>
              <p className="pb-1 text-sm text-muted-foreground">source observations acknowledged</p>
            </div>
            {receipts.data.items.length ? (
              <div className="mt-3 space-y-2">
                {receipts.data.items.slice(0,6).map(item => (
                  <div key={item.source_system+item.source_event_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{item.source_system} · {item.facility_id}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(item.observed_at)} · received {formatDateTime(item.received_at)}</p>
                    </div>
                    <span className={item.temperature_c>6?"font-semibold text-amber-700":"font-semibold text-emerald-700"}>
                      {item.temperature_c.toFixed(1)}°C
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-muted-foreground">
              No source records yet. Connect ABBIS and leave its automatic feed running.
            </p>}
            <p className="mt-3 text-xs text-muted-foreground">
              Four qualifying consecutive hourly readings create one investigation case—not four separate cases.
            </p>
          </>}
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm ring-1 ring-border/80">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:px-5">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setOffset(0); }}
                placeholder="Search incoming cases or facilities…"
                aria-label="Search incoming cases"
                className="pl-9"
              />
            </div>
            {incidents.data && <p className="text-sm text-muted-foreground">
              {incidents.data.total.toLocaleString("en-GB")} received cases
            </p>}
          </div>
          {incidents.isPending && <LoadingState label="Checking incoming case records…" />}
          {incidents.isError &&
            <div className="p-5">
              <ErrorState message={incidents.error.message} onRetry={() => void incidents.refetch()} />
            </div>}
          {incidents.data && (
            <>
              {incidents.data.items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 p-10 text-center">
                  <Cable className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="font-semibold">No incidents received yet</p>
                  <p className="max-w-lg text-sm text-muted-foreground">
                    This is the correct empty starting state. ABBIS holds the original synthetic
                    datasets. Once connected, ABBIS automatically sends source observations;
                    TrustLedger creates cases only when the incoming evidence meets a review rule.
                  </p>
                  <Link className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted" href="/connections">
                    Check source connection
                  </Link>
                </div>
              ) : <IncidentTable incidents={incidents.data.items} />}
              {incidents.data.total > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t px-4 py-3 sm:px-5">
                  <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                    <Button variant="outline" size="sm"
                      disabled={offset + PAGE_SIZE >= incidents.data.total}
                      onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Source events are imported over the authenticated adapter, but not every reading
        becomes an incident. Clinical disposition remains outside this prototype; every
        investigation requires the established worker-to-supervisor review process.
      </p>
    </>
  );
}
