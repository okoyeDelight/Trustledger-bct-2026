"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Database, RefreshCw, Send, ShieldCheck, Thermometer } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchCurrentUser } from "@/lib/api";

type SourceObservation = {
  schema_version: "trustledger.observation.v1";
  source_system: string;
  source_event_id: string;
  facility_id: string;
  observed_at: string;
  temperature_c: number;
};
type SourceSample = {
  items: SourceObservation[];
  source_incident_id: string;
  mode: string;
  source_revision: string;
  timestamp_note: string;
};
type Acknowledgement = {
  status: "received" | "duplicate_acknowledged";
  source_event_id: string;
  observation_stored: boolean;
  case_reference: string | null;
  case_created: boolean;
};
type ReturnedStatus = {
  case_reference: string;
  investigation_status: string;
  review_events: {event_kind: string; actor_role: string; created_at: string}[];
  clinical_clearance: null;
  delivery_mode: string;
};
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? undefined : {"Content-Type": "application/json"},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (result as {detail?:unknown}).detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status})`);
  }
  return result as T;
}

export default function ConnectionsPage() {
  const router = useRouter();
  const user = useQuery({queryKey:["current-user"],queryFn:fetchCurrentUser,retry:false});
  const source = useQuery({queryKey:["sandbox-pinned-source"],queryFn:()=>api<SourceSample>("/api/integrations/sandbox/sample"),retry:false});
  const [acknowledgements,setAcknowledgements] = useState<Acknowledgement[]>([]);
  const [caseId,setCaseId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const last = window.sessionStorage.getItem("trustledger-replay-case-id");
      if (last && /^EXT-[a-f0-9-]{36}$/.test(last)) queueMicrotask(() => setCaseId(last));
    } catch { /* Session storage can be blocked. */ }
  }, []);

  const replay = useMutation({
    mutationFn: async (events: SourceObservation[]) => {
      setAcknowledgements([]);
      let current: string | null = null;
      for (const observation of events) {
        const acknowledgement = await api<Acknowledgement>("/api/connectors/v1/observations",observation);
        setAcknowledgements(previous => [...previous, acknowledgement]);
        if (acknowledgement.case_reference) {
          current = acknowledgement.case_reference;
          setCaseId(current);
          try {window.sessionStorage.setItem("trustledger-replay-case-id",current);} catch {}
        }
      }
      return current;
    },
  });
  const status=useQuery({
    queryKey:["connector-return-status",caseId],
    queryFn:()=>api<ReturnedStatus>(`/api/connectors/v1/cases/${encodeURIComponent(caseId || "")}`),
    enabled:Boolean(caseId),
    retry:false,
  });
  const observations=source.data?.items ?? [];
  const canReplay=user.data?.role === "facility_staff";

  return <div className="mx-auto max-w-3xl space-y-5">
    <PageHeading
      eyebrow="Connected blood-bank workflow"
      title="ABBIS Sandbox → TrustLedger"
      description="See historical synthetic blood-bank readings travel through a real API into an investigation, then retrieve the review status."
    />
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-950">
      <strong>Source is simulated. Connection is functional.</strong> We replay verified synthetic records, not live ABBIS records or medical-device telemetry. TrustLedger validates and stores each reading.
    </div>

    <div className="grid grid-cols-3 gap-2">
      {[
        ["1","Receive","4 readings"],
        ["2","Investigate","Real case"],
        ["3","Return","Live status"],
      ].map(([number,name,detail]) => <div key={number} className="rounded-xl border bg-card p-3">
        <p className="text-xs font-semibold uppercase text-primary">Step {number}</p>
        <p className="mt-1 text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>)}
    </div>

    <Card className="shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <Database className="size-4"/> Source: ABBIS-like sandbox
        </div>
        <CardTitle className="text-lg">A refrigerator monitoring sequence</CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Four consecutive hourly readings from the pinned hackathon dataset. Send them one at a time and watch whether TrustLedger opens a case.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {source.isPending && <p role="status" className="text-sm text-muted-foreground">Loading verified synthetic readings…</p>}
        {source.isError && <p role="alert" className="text-sm text-destructive">{source.error.message}</p>}
        {source.data && <>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Source facility</p>
            <p className="text-sm font-semibold">{observations[0]?.facility_id}</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {observations.map((item,i) => {
                const ack=acknowledgements.some(x=>x.source_event_id===item.source_event_id);
                return <div key={item.source_event_id} className="rounded-lg border bg-background p-2 text-center">
                  <Thermometer className="mx-auto size-4 text-muted-foreground" aria-hidden="true"/>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{item.temperature_c.toFixed(1)}°</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{ack ? "Received" : `Hour ${i+1}`}</p>
                  {ack && <CheckCircle2 className="mx-auto mt-1 size-3.5 text-green-700" aria-label="Acknowledged"/>}
                </div>;
              })}
            </div>
          </div>
          {canReplay
            ? <Button className="w-full" disabled={replay.isPending||observations.length!==4} onClick={()=>replay.mutate(observations)}>
                <Send className="mr-2 size-4"/>
                {replay.isPending ? `Delivering ${acknowledgements.length} of 4 readings…` : acknowledgements.length ? "Send again — verify no duplicates" : "Send readings to TrustLedger"}
              </Button>
            : <p className="rounded-lg border p-3 text-sm text-muted-foreground">The Facility Operator sends the source feed. Supervisors can inspect the shared incident after it arrives.</p>
          }
          {replay.isError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Delivery stopped: {replay.error.message}. Retrying is safe because events are idempotent.</p>}
          {acknowledgements.length>0 && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <CheckCircle2 className="mr-2 inline size-4"/>
            {acknowledgements.length} of {observations.length} observations acknowledged.
            {acknowledgements.some(x=>x.status==="duplicate_acknowledged") && " Duplicates were not stored again."}
            {caseId ? " A sustained candidate is available for investigation." : " No sustained candidate yet."}
          </div>}
        </>}
      </CardContent>
    </Card>

    {caseId && <Card className="border-primary/25 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="size-4"/> Real investigation created</div>
        <CardTitle className="break-all text-base">{caseId}</CardTitle>
        <p className="text-sm text-muted-foreground">A sustained evidence candidate is now part of the ordinary Incidents → Worker → Supervisor workflow.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button className="w-full" onClick={()=>router.push("/incidents/"+encodeURIComponent(caseId))}>
          Open investigation <ArrowRight className="ml-2 size-4"/>
        </Button>
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Status returned to source</p>
            <Button size="sm" variant="outline" onClick={()=>void status.refetch()} disabled={status.isFetching}>
              <RefreshCw className="mr-1 size-3.5"/> Refresh
            </Button>
          </div>
          {status.isPending && <p className="mt-2 text-sm text-muted-foreground">Retrieving the shared status…</p>}
          {status.isError && <p role="alert" className="mt-2 text-sm text-destructive">{status.error.message}</p>}
          {status.data && <div className="mt-3 space-y-2 text-sm">
            <p><span className="text-muted-foreground">Investigation:</span> <strong className="capitalize">{status.data.investigation_status.replaceAll("_"," ")}</strong></p>
            <p><span className="text-muted-foreground">Recorded handoffs:</span> {status.data.review_events.length}</p>
            <p><span className="text-muted-foreground">Clinical clearance:</span> Not provided</p>
          </div>}
        </div>
      </CardContent>
    </Card>}

    <details className="rounded-xl border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Connection details and limitations</summary>
      <div className="mt-3 space-y-2 border-t pt-3 text-muted-foreground">
        <p>{source.data?.mode ?? "Synthetic source replay."}</p>
        <p>{source.data?.timestamp_note}</p>
        <p>Incoming API: POST /api/connectors/v1/observations. Returned status API: GET /api/connectors/v1/cases/[reference]. Both are authenticated. The sandbox sends four requests, receives genuine acknowledgements, and keeps a case reference.</p>
        <p>Four consecutive hourly readings above the prototype 6°C threshold establish an investigation candidate, not confirmed blood-unit exposure or a clinical disposition.</p>
        <p>Outgoing delivery currently uses a pull API. Webhooks, facility-scoped partner identity and a live ABBIS connection are future integrations.</p>
        <p>Raw synthetic source Git revision: <span className="break-all font-mono text-xs">{source.data?.source_revision}</span></p>
      </div>
    </details>
  </div>;
}
