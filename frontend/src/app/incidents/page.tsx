"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { IncidentTable } from "@/components/incident-table";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchIncidents } from "@/lib/api";

const PAGE_SIZE = 50;

export default function IncidentsPage() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"active" | "historical">("active");
  const incidents = useQuery({
    queryKey: ["incidents", search, offset, view],
    queryFn: () => fetchIncidents(PAGE_SIZE, offset, search, view),
    refetchInterval: view === "active" ? 15000 : false,
  });

  const totalPages = incidents.data ? Math.max(1, Math.ceil(incidents.data.total / PAGE_SIZE)) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <PageHeading
        eyebrow="Incident management"
        title="Temperature incidents"
        description="New cases arrive from connected blood-bank systems and staff reports. The earlier synthetic batch is kept separately as historical reference."
      />
      <Card className="border-0 shadow-sm ring-1 ring-border/80">
        <CardContent className="p-0">
          <div className="flex flex-wrap gap-2 border-b p-4 sm:px-5" role="group" aria-label="Incident list view">
            <Button size="sm" variant={view==="active"?"default":"outline"} onClick={()=>{setView("active");setOffset(0);}}>Live incident queue</Button>
            <Button size="sm" variant={view==="historical"?"default":"outline"} onClick={()=>{setView("historical");setOffset(0);}}>Historical reference</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:px-5">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOffset(0);
                }}
                placeholder="Search incident, facility, severity…"
                aria-label="Search incidents"
                className="pl-9"
              />
            </div>
            {incidents.data && (
              <p className="text-sm text-muted-foreground">
                {incidents.data.total.toLocaleString("en-GB")} {view==="active"?"active cases":"historical incidents"}
              </p>
            )}
          </div>
          {incidents.isPending && <LoadingState label="Loading incident records…" />}
          {incidents.isError && <div className="p-5"><ErrorState message={incidents.error.message} onRetry={() => void incidents.refetch()} /></div>}
          {incidents.data && (
            <>
              {view==="active" && incidents.data.items.length===0 ? <div className="p-8 text-center"><p className="font-semibold">No live incidents received yet</p><p className="mt-2 text-sm text-muted-foreground">Connect an external blood-bank source to feed records automatically, or submit a staff report. Historical reference incidents are available in the other tab.</p></div> : <IncidentTable incidents={incidents.data.items} />}
              {incidents.data.total > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t px-4 py-3 sm:px-5">
                  <p className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= incidents.data.total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        The live queue contains API-received incidents and staff reports; historical reference is separate. Detection flags require human investigation and do not determine clinical product disposition.
      </p>
    </>
  );
}
