"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, FlaskConical, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Evidence = { label: string; value: string };
type Scenario = { id: string; title: string; question: string; source: string; risk: string };
type Result = Scenario & {
  evidence: Evidence[]; rule_executed: string; naive_comparison: string;
  competent_baseline: string; trustledger_conclusion: string;
  next_step: string; decision_scope: string; evaluation: string;
};
type ContractResult = {
  accepted_for_schema_validation: boolean;
  persisted: boolean;
  interoperability: string;
  notice: string;
};

async function jsonRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const issue = result as { detail?: unknown };
    throw new Error(typeof issue.detail === "string" ? issue.detail : `HTTP ${response.status}: schema validation failed`);
  }
  return result as T;
}

const validObservation = {
  schema_version: "trustledger.observation.v1",
  source_system: "SyntheticMonitor-A",
  source_event_id: "SYN-2026-001",
  facility_id: "SYN-A",
  observed_at: "2026-10-01T09:00:00+01:00",
  temperature_c: 4.2,
};

export default function ProofLabPage() {
  const scenarios = useQuery({
    queryKey: ["proof-lab-scenarios"],
    queryFn: () => jsonRequest<{ items: Scenario[] }>("/api/proof-lab/scenarios"),
    retry: false,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [contractState, setContractState] = useState<"valid" | "invalid" | null>(null);
  const proof = useMutation({
    mutationFn: (id: string) => jsonRequest<Result>(`/api/proof-lab/scenarios/${encodeURIComponent(id)}/run`, {}),
  });
  const contract = useMutation({
    mutationFn: (valid: boolean) => jsonRequest<ContractResult>("/api/proof-lab/validate-import",
      valid ? validObservation : { ...validObservation, observed_at: undefined }),
  });

  const run = (id: string) => {
    setSelected(id);
    proof.mutate(id);
  };
  const validate = (valid: boolean) => {
    setContractState(valid ? "valid" : "invalid");
    contract.mutate(valid);
  };

  return <div className="max-w-5xl space-y-6">
    <PageHeading
      eyebrow="Judge verification · controlled synthetic evidence"
      title="Proof Lab"
      description="Try to break the evidence rules. These are executable synthetic challenges, not a slideshow or clinical software."
    />
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
      <strong>The claim we are testing:</strong> TrustLedger should surface uncertainty and preserve an accountable investigation — not predict product safety. A competent conventional monitor may detect the same anomalies.
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {scenarios.isPending && <p className="text-sm text-slate-600">Loading challenges…</p>}
      {scenarios.isError && <p role="alert" className="text-sm text-red-700">{scenarios.error.message}</p>}
      {scenarios.data?.items.map((s, idx) => (
        <Card key={s.id} className={selected === s.id ? "border-blue-400 shadow-md" : "shadow-sm"}>
          <CardHeader className="space-y-2 pb-2">
            <Badge variant="outline" className="w-fit">Challenge {idx + 1}</Badge>
            <CardTitle className="text-lg">{s.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-700">{s.question}</p>
            <Button className="w-full" variant={selected === s.id ? "default" : "outline"} disabled={proof.isPending} onClick={() => run(s.id)}>
              <FlaskConical className="mr-2 size-4" /> Run evidence test
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>

    {proof.isPending && <p role="status" className="text-sm">Executing source processing rules…</p>}
    {proof.isError && <p role="alert" className="rounded-lg border border-red-200 p-4 text-sm text-red-800">Challenge failed: {proof.error.message}</p>}
    {proof.isSuccess && selected === proof.data.id && <Card className="overflow-hidden border-green-200 shadow-sm">
      <CardHeader className="border-b bg-green-50/70">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-green-800">
          <CheckCircle2 className="size-4" /> Executed on the API
        </div>
        <CardTitle>{proof.data.title}</CardTitle>
        <p className="text-sm text-slate-600">{proof.data.rule_executed}</p>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {proof.data.evidence.map((row) => <div key={row.label} className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-900">{row.value}</p>
          </div>)}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Naive interpretation — not a fair production baseline</p>
            <p className="text-sm">{proof.data.naive_comparison}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Competent conventional system</p>
            <p className="text-sm">{proof.data.competent_baseline}</p>
          </div>
        </div>
        <div className="rounded-lg border-l-4 border-blue-600 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">TrustLedger triage result</p>
          <p className="mt-2 font-semibold text-blue-950">{proof.data.trustledger_conclusion}</p>
          <p className="mt-2 text-sm text-blue-950"><ArrowRight className="mr-1 inline size-4" /> {proof.data.next_step}</p>
        </div>
        <p className="text-xs text-slate-500">{proof.data.evaluation} {proof.data.decision_scope}</p>
      </CardContent>
    </Card>}

    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <ClipboardCheck className="size-4" /> Proposed interoperability contract
        </div>
        <CardTitle>Can an external observation pass validation?</CardTitle>
        <p className="text-sm text-slate-600">One complete sample and one missing the required timezone-aware observation time. Both are tested against the same backend schema.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={contract.isPending} onClick={() => validate(true)}>
            <ShieldCheck className="mr-2 size-4" /> Validate complete sample
          </Button>
          <Button variant="outline" disabled={contract.isPending} onClick={() => validate(false)}>
            <AlertCircle className="mr-2 size-4" /> Try missing timestamp
          </Button>
        </div>
        {contract.isPending && <p role="status" className="text-sm">Validating example payload…</p>}
        {contract.isSuccess && contractState === "valid" && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          <strong>Schema accepted; no data ingested.</strong> {contract.data.notice} {contract.data.interoperability}
        </p>}
        {contract.isError && contractState === "invalid" && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>Rejected as expected (HTTP 422).</strong> The observation has no timestamp. No event was saved.
        </p>}
        {((contract.isError && contractState === "valid") || (contract.isSuccess && contractState === "invalid")) &&
          <p role="alert" className="text-sm text-red-700">Unexpected validator outcome. Inspect contract and API logs.</p>}
        <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-50">{JSON.stringify(validObservation, null, 2)}</pre>
        <p className="text-xs text-slate-500">This is a proposed versioned TrustLedger JSON contract, not a live ABBIS, FHIR or HL7 integration. Source authorization, facility mapping and authenticity require separate validation.</p>
      </CardContent>
    </Card>
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <strong>Honest benchmark:</strong> On these three hand-built test fixtures, a competent gap-aware, receipt-aware and sensor-quality-aware system can flag the same issues. TrustLedger's proposed incremental value is preserving the original evidence and the separate human investigation workflow; that value still requires independent user studies.
    </div>
  </div>;
}
