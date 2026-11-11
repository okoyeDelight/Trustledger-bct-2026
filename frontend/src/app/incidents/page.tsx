"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Search, Cable } from "lucide-react";
import { IncidentTable } from "@/components/incident-table";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchIncidents } from "@/lib/api";

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
    refetchInterval: 15000,
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
