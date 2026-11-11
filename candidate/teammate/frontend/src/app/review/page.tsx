"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/query-states";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchCurrentUser, fetchIncidents, submitReview, type ReviewSubmission } from "@/lib/api";
import type { AuthenticatedUser, ReviewDecision } from "@/lib/types";
import { formatDateTime } from "@/lib/date";

const fieldClassName = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
const textAreaClassName = "min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

export default function ReviewPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [incidentId, setIncidentId] = useState("");
  const [decision, setDecision] = useState<ReviewDecision>("accept");
  const [reason, setReason] = useState("");
  const [changedAssessment, setChangedAssessment] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const user = useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    enabled: typeof window !== "undefined",
  });
  const incidents = useQuery({
    queryKey: ["review-incidents", search],
    queryFn: () => fetchIncidents(100, 0, search),
  });
  const mutation = useMutation({
    mutationFn: ({ submission, actor }: {
      submission: ReviewSubmission;
      actor: AuthenticatedUser;
    }) => submitReview(submission, actor),
    onSuccess: async (result) => {
      setResultMessage(result.notice);
      if (result.status === "recorded" || result.status === "already_recorded") {
        setIncidentId("");
        setDecision("accept");
        setReason("");
        setChangedAssessment("");
        await queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      }
    },
  });

  const selectedIncident = incidents.data?.items.find(
    (incident) => incident.incident_id === incidentId,
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResultMessage("");
    if (!user.data) return;
    mutation.mutate({
      submission: {
        review_id: crypto.randomUUID(),
        incident_id: incidentId,
        decision,
        reason: reason.trim(),
        changed_assessment: decision === "change" ? changedAssessment.trim() : null,
      },
      actor: user.data,
    });
  }

  return (
    <>
      <PageHeading
        eyebrow="Human oversight · authenticated demo account"
        title="Review centre"
        description="A person reviews the incident evidence and records an Accept, Change or Reject decision for the investigation flag."
      />

      <div role="note" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <strong>Human review only.</strong> This records a review of the incident flag; it does not release, quarantine, discard, declare compatibility or authorize transfusion. The backend assigns your role and audit name from your configured demo account. Both demo roles currently share review permissions pending confirmation of the role matrix. This is prototype authentication, not production identity management.
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <Card className="border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader>
            <CardTitle>Record an investigation review</CardTitle>
            <p className="text-sm text-muted-foreground">Every decision needs a reason and is added to the append-only audit log.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                Signed in as <strong>{user.data?.actor_name ?? "Loading account…"}</strong>
                {user.data && <span className="text-muted-foreground"> · {user.data.role === "facility_staff" ? "Facility staff" : "Blood service supervisor"}</span>}
              </div>

              <label className="block space-y-2 text-sm font-medium">
                Find incident by ID or facility
                <Input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search incident, facility or severity"
                  value={search}
                />
              </label>

              {incidents.isPending && <LoadingState label="Loading incidents…" />}
              {incidents.isError && <ErrorState message={incidents.error.message} onRetry={() => void incidents.refetch()} />}
              {incidents.data && (
                <label className="block space-y-2 text-sm font-medium">
                  Incident
                  <select
                    className={fieldClassName}
                    onChange={(event) => setIncidentId(event.target.value)}
                    required
                    value={incidentId}
                  >
                    <option value="" disabled>Select an incident</option>
                    {incidents.data.items.map((incident) => (
                      <option key={incident.incident_id} value={incident.incident_id}>
                        {incident.incident_id} · {incident.facility_id} · {incident.severity}
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Showing {incidents.data.items.length} matching incidents. Search to find other records.
                  </span>
                </label>
              )}

              {selectedIncident && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 p-3 text-sm">
                  <Badge variant="outline">{selectedIncident.severity}</Badge>
                  <span>{selectedIncident.facility_id}</span>
                  <span className="text-muted-foreground">{formatDateTime(selectedIncident.start_time)}</span>
                  <span>{selectedIncident.reading_count} readings</span>
                </div>
              )}

              <label className="block space-y-2 text-sm font-medium">
                Investigation decision
                <select
                  className={fieldClassName}
                  onChange={(event) => setDecision(event.target.value as ReviewDecision)}
                  value={decision}
                >
                  <option value="accept">Accept flag for investigation</option>
                  <option value="change">Change the investigation assessment</option>
                  <option value="reject">Reject flag as unsupported by evidence</option>
                </select>
              </label>

              {decision === "change" && (
                <label className="block space-y-2 text-sm font-medium">
                  Changed assessment
                  <textarea
                    className={textAreaClassName}
                    maxLength={1000}
                    onChange={(event) => setChangedAssessment(event.target.value)}
                    required
                    value={changedAssessment}
                  />
                </label>
              )}
              <label className="block space-y-2 text-sm font-medium">
                Reason / evidence
                <textarea
                  className={textAreaClassName}
                  maxLength={1000}
                  minLength={5}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  value={reason}
                />
              </label>

              {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
              {resultMessage && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{resultMessage}</p>}
              <Button disabled={mutation.isPending || !incidentId || !user.data} type="submit">
                <ClipboardCheck aria-hidden="true" />
                {mutation.isPending ? "Saving review…" : "Save human review"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader><CardTitle>What this review means</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p><strong className="text-foreground">Accept</strong> confirms the flag should remain in the investigation queue.</p>
            <p><strong className="text-foreground">Change</strong> records a human-authored assessment and supporting reason.</p>
            <p><strong className="text-foreground">Reject</strong> records that the flag is not supported by the review evidence.</p>
            <p>These are prototype workflow states, not product disposition decisions. No inventory or patient-care system is changed.</p>
            <p>The role is assigned by the backend from a pre-provisioned demo account. Production use requires a managed identity provider, reviewed authorization rules and secure session operations.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
