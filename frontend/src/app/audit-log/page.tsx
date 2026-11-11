"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/query-states";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchCaseHistory, fetchCurrentUser, fetchReviewAudit, getPendingReviews } from "@/lib/api";
import type { ReviewEvent } from "@/lib/types";
import { formatDateTime } from "@/lib/date";

export default function AuditLogPage() {
  const queryClient = useQueryClient();
  const [pendingEvents, setPendingEvents] = useState<ReviewEvent[]>([]);
  const [otherAccountPendingCount, setOtherAccountPendingCount] = useState(0);
  const user = useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    enabled: typeof window !== "undefined",
  });
  const audit = useQuery({
    queryKey: ["audit-log"],
    queryFn: fetchReviewAudit,
  });
  const history = useQuery({
    queryKey:["case-history"],
    queryFn:fetchCaseHistory,
  });

  useEffect(() => {
    const refresh = () => {
      const allPending = getPendingReviews();
      setPendingEvents(user.data ? getPendingReviews(user.data) : []);
      setOtherAccountPendingCount(allPending.length - (user.data ? getPendingReviews(user.data).length : 0));
    };
    const onConnectionChange = () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    };
    refresh();
    window.addEventListener("trustledger:offline-state", onConnectionChange);
    return () => window.removeEventListener("trustledger:offline-state", onConnectionChange);
  }, [queryClient, user.data]);

  const events = [
    ...pendingEvents,
    ...(audit.data?.items ?? []).filter(
      (record) => !pendingEvents.some((pending) => pending.review_id === record.review_id),
    ),
  ];

  return (
    <>
      <PageHeading
        eyebrow="Traceability"
        title="History"
        description="Trace incidents through investigation submissions, supervisor decisions, assigned follow-up and administrative closure."
        action={<ScrollText className="size-5 text-primary" aria-hidden="true" />}
      />

      <div role="note" className="mb-6 rounded-xl border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
        Server-confirmed history is read from the backend. In hosted mode, records use the shared Neon database. Historical browser-only review drafts are <strong>not submitted</strong> and are not automatically synced. No event authorizes clinical blood release.
      </div>

      <section aria-label="Case activity" className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Case activity</h2>
        {history.isPending&&<LoadingState label="Loading the shared case history…"/>}
        {history.isError&&<ErrorState message={history.error.message} onRetry={()=>void history.refetch()}/>}
        {history.data?.items.length===0&&
          <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            No submitted investigations, decisions or follow-up actions have been recorded yet.
          </p>}
        {history.data?.items.length ? <ol className="space-y-3">
          {history.data.items.map(event=><li key={event.id}>
            <Card className="border-0 shadow-sm ring-1 ring-border/80">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={"/incidents/"+encodeURIComponent(event.case_reference)}
                    className="font-semibold text-primary hover:underline">{event.case_reference}</Link>
                  <Badge variant="outline">{event.event_kind.replaceAll("_"," ")}</Badge>
                </div>
                {typeof event.details.summary==="string"&&
                  <p className="mt-2 text-sm">{event.details.summary}</p>}
                {typeof event.details.description==="string"&&
                  <p className="mt-2 text-sm">{event.details.description}</p>}
                {typeof event.details.reason==="string"&&
                  <p className="mt-2 text-sm">{event.details.reason}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {event.actor_name} · {formatDateTime(event.created_at)}
                </p>
              </CardContent>
            </Card>
          </li>)}
        </ol> : null}
      </section>
      <h2 className="mb-3 text-lg font-semibold">Supervisor review decisions</h2>
      {otherAccountPendingCount > 0 && (
        <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {otherAccountPendingCount} pending review{otherAccountPendingCount === 1 ? "" : "s"} from another demo account {otherAccountPendingCount === 1 ? "is" : "are"} hidden while this account is active. Sign in as the original reviewer to inspect them and, if still appropriate, submit a fresh review.
        </p>
      )}

      {audit.isPending && events.length === 0 && <LoadingState label="Loading the audit log…" />}
      {audit.isError && events.length === 0 && (
        <ErrorState message={audit.error.message} onRetry={() => void audit.refetch()} />
      )}
      {audit.isError && events.length > 0 && (
        <p role="status" className="mb-4 text-sm text-amber-900">
          The API is unavailable. Any browser-only drafts shown are not verified server records.
        </p>
      )}
      {events.length > 0 ? (
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.review_id}>
              <Card className="border-0 shadow-sm ring-1 ring-border/80">
                <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{event.incident_id}</span>
                      <Badge variant="outline">{event.decision}</Badge>
                      {event.sync_status === "pending_sync" && (
                        <Badge className="border-amber-300 bg-amber-50 text-amber-900" variant="outline">Local only · not submitted</Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6">{event.reason}</p>
                    {event.changed_assessment && (
                      <p className="mt-2 rounded-md bg-muted/60 p-2 text-sm">
                        Changed assessment: {event.changed_assessment}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      {event.actor_name} · {event.role === "facility_staff" ? "Facility staff" : "Blood service supervisor"}
                      {" · "}
                      {event.sync_status === "pending_sync"
                        ? "Local browser entry · not server-confirmed"
                        : event.auth_method === "preprovisioned_demo_account"
                          ? "Pre-provisioned demo account"
                          : "Legacy self-reported identity"}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={event.created_at}>
                    {formatDateTime(event.created_at)}
                  </time>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      ) : audit.data?.total === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
          No supervisor review decisions have been recorded yet. A worker must submit an investigation before review.
        </div>
      ) : null}
    </>
  );
}
