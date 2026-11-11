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
  const incidents = useQuery({
    queryKey: ["incidents", search, offset],
    queryFn: () => fetchIncidents(PAGE_SIZE, offset, search),
  });

  const totalPages = incidents.data ? Math.max(1, Math.ceil(incidents.data.total / PAGE_SIZE)) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <PageHeading
        eyebrow="Incident management"
        title="Temperature incidents"
        description="Search and review every detected warning and sustained excursion in the processed dataset."
      />
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
                placeholder="Search incident, facility, severity…"
                aria-label="Search incidents"
                className="pl-9"
              />
            </div>
            {incidents.data && (
              <p className="text-sm text-muted-foreground">
                {incidents.data.total.toLocaleString("en-GB")} matching incidents
              </p>
            )}
          </div>
          {incidents.isPending && <LoadingState label="Loading incident records…" />}
          {incidents.isError && <div className="p-5"><ErrorState message={incidents.error.message} onRetry={() => void incidents.refetch()} /></div>}
          {incidents.data && (
            <>
              <IncidentTable incidents={incidents.data.items} />
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
        Incident windows are approximate hourly bounds. The table is read-only and does not determine product disposition.
      </p>
    </>
  );
}
