"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/query-states";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchCurrentUser, fetchReviewQueue, submitReview, type ReviewSubmission } from "@/lib/api";
import type { AuthenticatedUser, ReviewDecision } from "@/lib/types";

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
  const pending = useQuery({
    queryKey:["review-queue"],
    queryFn:fetchReviewQueue,
    enabled:user.data?.role==="blood_service_supervisor",
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
        await Promise.all([
          queryClient.invalidateQueries({queryKey:["audit-log"]}),
          queryClient.invalidateQueries({queryKey:["review-queue"]}),
        ]);
      }
    },
  });

  const eligible = (pending.data?.items||[]).filter(item=>
    item.case_reference.toLowerCase().includes(search.trim().toLowerCase())
  );
  const selectedIncident = eligible.find(item=>item.case_reference===incidentId);

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
        description="Review only investigations submitted by facility staff. Record an Accept, Return or Reject decision with evidence."
      />

      <div role="note" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <strong>Human review only.</strong> This records a review of the incident flag; it does not release, quarantine, discard, declare compatibility or authorize transfusion. The backend validates which demo account is signed in. Only the supervisor role may record a review; facility staff can investigate but cannot approve their own work. This remains prototype authentication.
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <Card className="border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader>
            <CardTitle>Record an investigation review</CardTitle>
            <p className="text-sm text-muted-foreground">Every decision needs a reason and is added to the append-only audit log.</p>
          </CardHeader>
          <CardContent>
            {user.data?.role==="facility_staff" && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Your role is facility staff. Record an investigation finding in the incident detail page; a separate supervisor must review it.</p>}
            {user.data?.role!=="facility_staff" && <form className="space-y-5" onSubmit={onSubmit}>
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                Signed in as <strong>{user.data?.actor_name ?? "Loading account…"}</strong>
                {user.data && <span className="text-muted-foreground"> · Blood service supervisor</span>}
              </div>

              <label className="block space-y-2 text-sm font-medium">
                Search submitted cases
                <Input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search a case reference"
                  value={search}
                />
              </label>

              {pending.isPending&&user.data?.role==="blood_service_supervisor"&&<LoadingState label="Loading submitted investigations…" />}
              {pending.isError&&<ErrorState message={pending.error.message} onRetry={()=>void pending.refetch()}/>}
              {pending.data && (
                <label className="block space-y-2 text-sm font-medium">
                  Incident
                  <select
                    className={fieldClassName}
                    onChange={(event) => setIncidentId(event.target.value)}
                    required
                    value={incidentId}
                  >
                    <option value="" disabled>Select an incident</option>
                    {eligible.map((incident) => (
                      <option key={incident.case_reference} value={incident.case_reference}>
                        {incident.case_reference} · submitted by {incident.submitted_by}
                      </option>
                    ))}
                  </select>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Showing {eligible.length} submitted case(s). Others cannot be reviewed until a worker submits findings.
                  </span>
                </label>
              )}

              {selectedIncident && (
                <div className="rounded-lg bg-muted/60 p-3 text-sm">
                  {selectedIncident.case_reference} · Submitted by {selectedIncident.submitted_by}.
                  Open the case details to inspect worker findings before signing.
                </div>
              )}

              <label className="block space-y-2 text-sm font-medium">
                Investigation decision
                <select
                  className={fieldClassName}
                  onChange={(event) => setDecision(event.target.value as ReviewDecision)}
                  value={decision}
                >
                  <option value="accept">Accept the investigation assessment</option>
                  <option value="change">Return to worker for more evidence</option>
                  <option value="reject">Reject the investigation flag with reason</option>
                </select>
              </label>

              {decision === "change" && (
                <label className="block space-y-2 text-sm font-medium">
                  What needs correction
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
              <Button disabled={mutation.isPending || !incidentId || user.data?.role!=="blood_service_supervisor"} type="submit">
                <ClipboardCheck aria-hidden="true" />
                {mutation.isPending ? "Saving review…" : "Save human review"}
              </Button>
            </form>}
          </CardContent>
        </Card>

        <Card className="h-fit border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader><CardTitle>What this review means</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p><strong className="text-foreground">Accept</strong> confirms the flag should remain in the investigation queue.</p>
            <p><strong className="text-foreground">Change</strong> records a human-authored assessment and supporting reason.</p>
            <p><strong className="text-foreground">Reject</strong> records that the flag is not supported by the review evidence.</p>
            <p>These are prototype workflow states, not product disposition decisions. No inventory or patient-care system is changed.</p>
            <p>Review requires a separate supervisor account and is checked by the server. Managed identity, independent clinical authorization and production retention are not yet implemented.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
