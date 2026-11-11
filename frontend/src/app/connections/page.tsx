"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleHelp, PlugZap, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCurrentUser } from "@/lib/api";

const DEMO_ALERT = {
  schema_version: "trustledger.observation.v1",
  source_system: "Simulated ABBIS connector",
  source_event_id: "SYN-ABBIS-ALERT-001",
  facility_id: "SYN-HOSP-01",
  observed_at: "2026-10-01T09:00:00+01:00",
  temperature_c: 7.2,
};

type ReceivedCase = {
  status: "incident_created" | "already_imported" | "in_range_not_recorded";
  case_reference: string | null;
  persisted: boolean;
  notice: string;
};

type ReturnedStatus = {
  case_reference: string;
  investigation_status: string;
  source_system: string;
  source_event_id: string;
  review_events: Array<{ event_kind: string; created_at: string }>;
  clinical_clearance: null;
};

async function callApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const obj = result as { detail?: unknown };
    throw new Error(typeof obj.detail === "string" ? obj.detail : `Request failed (${response.status})`);
  }
  return result as T;
}

export default function ConnectionsPage() {
  const router = useRouter();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [received, setReceived] = useState<ReceivedCase | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const user = useQuery({ queryKey: ["current-user"], queryFn: fetchCurrentUser, retry: false });

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("trustledger-demo-connection-case");
      if (stored && /^EXT-[0-9a-f-]{36}$/.test(stored)) queueMicrotask(() => setCaseId(stored));
    } catch { /* Storage may be unavailable in a protected browser. */ }
  }, []);

  const ingest = useMutation({
    mutationFn: () => callApi<ReceivedCase>("/api/integrations/demo/observations", DEMO_ALERT),
    onSuccess: result => {
      setReceived(result);
      if (result.case_reference) {
        setCaseId(result.case_reference);
        try { window.sessionStorage.setItem("trustledger-demo-connection-case", result.case_reference); } catch {}
      }
    },
  });

  const status = useQuery({
    queryKey: ["demo-integration-case", caseId],
    queryFn: () => callApi<ReturnedStatus>(`/api/integrations/demo/cases/${encodeURIComponent(caseId || "")}`),
    enabled: Boolean(caseId),
    retry: false,
  });

  return <div className="mx-auto max-w-3xl space-y-5">
    <PageHeading
      eyebrow="Blood-bank system connection · demonstration"
      title="Connect an external blood-bank record"
      description="See one synthetic monitoring alert enter TrustLedger, become an investigation, and return its latest case status."
    />
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-950">
      <strong>Simulated ABBIS connection.</strong> No real ABBIS, hospital system or temperature device is connected. This preview uses a controlled synthetic sample with an authenticated demo operator.
    </div>

    <div className="grid gap-2 sm:grid-cols-3">
      {[
        { title: "1. Receive", detail: "Accept a sample alert" },
        { title: "2. Investigate", detail: "Open the real case workflow" },
        { title: "3. Return", detail: "Read the latest review status" },
      ].map((step) => (
        <div key={step.title} className="rounded-xl border bg-card p-3">
          <p className="text-sm font-semibold">{step.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
        </div>
      ))}
    </div>

    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <PlugZap className="size-4"/> Source: Simulated blood-bank monitoring feed
        </div>
        <CardTitle className="text-lg">A temperature alert needs attention</CardTitle>
        <p className="text-sm text-muted-foreground">A synthetic facility reports a single 7.2°C observation, above the prototype 6°C upper band. That warrants investigation, not automatic confirmation of blood-unit exposure.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Facility</p><p className="font-semibold">SYN-HOSP-01</p></div>
          <div><p className="text-xs text-muted-foreground">Observation</p><p className="font-semibold">7.2°C</p></div>
          <div><p className="text-xs text-muted-foreground">Source event</p><p className="font-semibold">SYN-ABBIS-ALERT-001</p></div>
        </div>
        {user.data?.role === "facility_staff" ? (
          <Button className="w-full" disabled={ingest.isPending} onClick={() => ingest.mutate()}>
            <Send className="mr-2 size-4"/> {ingest.isPending ? "Receiving observation…" : received ? "Send again (check for duplicates)" : "Receive sample alert"}
          </Button>
        ) : <p className="rounded-lg border p-3 text-sm text-muted-foreground">Sign in as the Facility Operator to receive the synthetic observation. Supervisors can inspect its existing case status below.</p>}
        {ingest.isError && <p role="alert" className="text-sm text-destructive">{ingest.error.message}</p>}
        {received && <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-950">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0"/>
          <span>{received.status === "already_imported" ? "Already received — no duplicate created." : "Observation received and saved as an investigation candidate."}</span>
        </div>}
      </CardContent>
    </Card>

    {caseId && <Card className="border-primary/30 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="size-4"/> Connected to the real incident workflow</div>
        <CardTitle className="break-all text-lg">{caseId}</CardTitle>
        <p className="text-sm text-muted-foreground">This case is in the same Incidents and Review workflow as every other TrustLedger case.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button className="w-full" onClick={() => router.push("/incidents/" + encodeURIComponent(caseId))}>
          Open investigation <ArrowRight className="ml-2 size-4"/>
        </Button>
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">Status returned to external system</p>
            <Button size="sm" variant="outline" onClick={() => void status.refetch()} disabled={status.isFetching}>
              <RefreshCw className="mr-2 size-3.5"/> Refresh
            </Button>
          </div>
          {status.isLoading && <p className="mt-2 text-sm text-muted-foreground">Reading the shared case status…</p>}
          {status.isError && <p role="alert" className="mt-2 text-sm text-destructive">{status.error.message}</p>}
          {status.data && <div className="mt-2 space-y-1 text-sm">
            <p><span className="text-muted-foreground">Investigation:</span> <strong className="capitalize">{status.data.investigation_status.replaceAll("_"," ")}</strong></p>
            <p><span className="text-muted-foreground">Recorded handoffs:</span> {status.data.review_events.length}</p>
            <p><span className="text-muted-foreground">Clinical clearance:</span> Not provided</p>
          </div>}
        </div>
      </CardContent>
    </Card>}

    <details className="rounded-xl border bg-card px-4 py-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium"><CircleHelp className="size-4"/> What does this prove—and what doesn&apos;t it?</summary>
      <div className="mt-3 space-y-2 border-t pt-3 text-muted-foreground">
        <p>The signed-in operator sends a versioned JSON observation to a FastAPI endpoint. The adapter checks its fields and temperature, stores a provisional incident in the append-only report ledger, and makes it available to our existing worker and supervisor workflow. A separate GET endpoint returns the case&apos;s latest status.</p>
        <p>Repeated identical source events are idempotent; reusing an event ID with different evidence is rejected. Incomplete timestamps are rejected rather than silently assumed.</p>
        <p>It does not implement external machine credentials, a real ABBIS interface, sensor connectivity, FHIR/HL7 interoperability, clinical authorization or routine telemetry storage. The source is a simulated fixture.</p>
        <Button size="sm" variant="outline" onClick={() => setShowRejected(x => !x)}>
          {showRejected ? "Hide example rejection" : "Show missing-timestamp example"}
        </Button>
        {showRejected && <p className="rounded-lg bg-amber-50 p-3 text-amber-950">A message without an observation timestamp is rejected by the API schema with HTTP 422. No case is written. This is covered by the automated integration test.</p>}
      </div>
    </details>
  </div>;
}
