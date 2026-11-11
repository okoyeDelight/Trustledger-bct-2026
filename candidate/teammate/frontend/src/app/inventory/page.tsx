"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/query-states";
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
import { fetchAffectedUnits } from "@/lib/api";
import { formatDateTime } from "@/lib/date";

const PAGE_SIZE = 50;

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [strategy, setStrategy] = useState<"sustained" | "baseline">("sustained");
  const inventory = useQuery({
    queryKey: ["affected-inventory", strategy, search, offset],
    queryFn: () => fetchAffectedUnits(PAGE_SIZE, offset, search, strategy),
  });
  const totalPages = inventory.data ? Math.max(1, Math.ceil(inventory.data.total / PAGE_SIZE)) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <PageHeading
        eyebrow="Traceability"
        title={strategy === "baseline" ? "Baseline fallback candidates" : "Investigation candidates"}
        description={strategy === "baseline"
          ? "Broader fallback view: any out-of-range reading is matched against unit location intervals."
          : "Search unit-level matches for sustained incidents; switch to the baseline when the sustained-event rule is unavailable or uncertain."}
      />
      <div role="note" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <strong>{strategy === "baseline" ? "Simple fallback: any out-of-range reading." : "These are investigation candidates only."}</strong>{" "}
        {strategy === "baseline"
          ? "This intentionally creates a broader list. A qualified person must review the original readings; this does not establish product safety or authorize a disposition."
          : "An overlap does not establish product safety or authorize release, discard, quarantine removal or transfusion."}
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
                placeholder="Search unit, incident, facility, group…"
                aria-label="Search investigation candidates"
                className="pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Detection view
              <select
                aria-label="Detection view"
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                onChange={(event) => {
                  setStrategy(event.target.value as "sustained" | "baseline");
                  setOffset(0);
                }}
                value={strategy}
              >
                <option value="sustained">Sustained filter</option>
                <option value="baseline">Single-reading fallback</option>
              </select>
            </label>
            {inventory.data && <p className="text-sm text-muted-foreground">{inventory.data.total.toLocaleString("en-GB")} matches</p>}
          </div>
          {inventory.isPending && <LoadingState label="Loading unit candidates…" />}
          {inventory.isError && <div className="p-5"><ErrorState message={inventory.error.message} onRetry={() => void inventory.refetch()} /></div>}
          {inventory.data && (
            <>
              {strategy === "baseline" && (
                <p className="border-b bg-muted/40 px-4 py-2 text-xs leading-5 text-muted-foreground sm:px-5">
                  {inventory.data.notice} The baseline favors coverage and may substantially increase false positives.
                </p>
              )}
              {inventory.data.items.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit ID</TableHead>
                      <TableHead>Incident</TableHead>
                      <TableHead>Facility</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Blood group</TableHead>
                      <TableHead>Recorded status</TableHead>
                      <TableHead>Exposure window</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.data.items.map((unit) => (
                      <TableRow key={`${unit.incident_id}-${unit.unit_id}`}>
                        <TableCell className="font-medium">{unit.unit_id}</TableCell>
                        <TableCell>
                          <Link className="text-primary hover:underline" href={`/incidents/${encodeURIComponent(unit.incident_id)}`}>
                            {unit.incident_id}
                          </Link>
                        </TableCell>
                        <TableCell>{unit.facility_id}</TableCell>
                        <TableCell>{unit.component}</TableCell>
                        <TableCell>{unit.blood_group}</TableCell>
                        <TableCell className="capitalize">{unit.unit_status}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(unit.exposure_start)} – {formatDateTime(unit.exposure_end)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">No candidates match this search.</p>
              )}
              {inventory.data.total > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t px-4 py-3 sm:px-5">
                  <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= inventory.data.total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
