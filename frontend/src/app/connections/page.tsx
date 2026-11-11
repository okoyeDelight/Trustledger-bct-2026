"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, Check, ClipboardCopy, KeyRound, LockKeyhole, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchCurrentUser } from "@/lib/api";

type Connection = {
  id:string; label:string; source_system:string; facility_code:string;
  key_prefix:string; created_by:string; created_at:string;
  revoked:boolean; last_observation_at:string|null;
};
type NewConnection = Connection & {key:string};

async function api<T>(path:string, method:"GET"|"POST"="GET", body?:unknown):Promise<T> {
  const response=await fetch(path,{
    method,cache:"no-store",credentials:"include",
    headers:body===undefined?undefined:{"Content-Type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const payload:unknown=await response.json().catch(()=>({}));
  if(!response.ok){
    const issue=payload as {detail?:unknown};
    throw new Error(typeof issue.detail==="string"?issue.detail:`Request failed (${response.status})`);
  }
  return payload as T;
}

export default function ConnectionsPage(){
  const qc=useQueryClient();
  const router=useRouter();
  const user=useQuery({queryKey:["current-user"],queryFn:fetchCurrentUser,retry:false});
  const isSupervisor=user.data?.role==="blood_service_supervisor";
  const connections=useQuery({
    queryKey:["connected-systems"],
    queryFn:()=>api<{items:Connection[]}>("/api/connections"),
    enabled:isSupervisor,retry:false,
  });
  const [showForm,setShowForm]=useState(false);
  const [name,setName]=useState("");
  const [source,setSource]=useState("");
  const [facility,setFacility]=useState("");
  const [issued,setIssued]=useState<NewConnection|null>(null);
  const [copied,setCopied]=useState(false);
  const [isCopyError,setCopyError]=useState(false);
  const register=useMutation({
    mutationFn:()=>api<NewConnection>("/api/connections","POST",{
      label:name.trim(),source_system:source.trim(),facility_code:facility.trim(),
    }),
    onSuccess:record=>{
      setIssued(record);
      setCopied(false);
      setCopyError(false);
      setShowForm(false);
      setName("");setSource("");setFacility("");
      void qc.invalidateQueries({queryKey:["connected-systems"]});
    }
  });
  const revoke=useMutation({
    mutationFn:(id:string)=>api<{revoked:boolean}>(`/api/connections/${encodeURIComponent(id)}/revoke`,"POST"),
    onSuccess:()=>void qc.invalidateQueries({queryKey:["connected-systems"]}),
  });
  async function copy(value:string){
    try{await navigator.clipboard.writeText(value);setCopied(true);setCopyError(false);}
    catch{setCopyError(true);setCopied(false);}
  }
  const base=typeof window!=="undefined"?window.location.origin:"";
  const receiveUrl=base+"/api/connectors/v1/observations";
  const outgoingUrl=base+"/api/connectors/v1/cases";

  return <div className="mx-auto max-w-3xl space-y-5">
    <PageHeading
      eyebrow="System integrations"
      title="Connected systems"
      description="Connect an external blood-bank information system to send temperature observations and receive investigation updates."
    />
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border bg-card p-4">
        <Cable className="mb-2 size-5 text-primary"/>
        <p className="font-semibold">Incoming data</p>
        <p className="mt-1 text-sm text-muted-foreground">Verified source events flow into TrustLedger.</p>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <RefreshCw className="mb-2 size-5 text-primary"/>
        <p className="font-semibold">Outgoing updates</p>
        <p className="mt-1 text-sm text-muted-foreground">Partners retrieve their own case statuses through an API.</p>
      </div>
    </div>

    {user.isPending && <p role="status" className="text-sm text-muted-foreground">Checking access…</p>}
    {user.isError && <p role="alert" className="text-sm text-destructive">{user.error.message}</p>}

    {isSupervisor && <Card className="shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Your connected systems</CardTitle>
          {!issued && !showForm && <Button size="sm" onClick={()=>setShowForm(true)}>
            <Plus className="mr-1 size-4"/> Connect system
          </Button>}
        </div>
        <p className="text-sm text-muted-foreground">Each system receives its own credential, restricted to one source name and facility.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {issued && <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-950">
          <div className="flex items-center gap-2 font-semibold"><KeyRound className="size-4"/> API key created</div>
          <p className="text-sm">Copy this key into your external system. <strong>It is shown only once.</strong> Do not put it in browser scripts, screenshots, or public repositories.</p>
          <div className="break-all rounded-lg border border-green-200 bg-white p-3 font-mono text-xs select-all">{issued.key}</div>
          <Button className="w-full" variant="outline" onClick={()=>void copy(issued.key)}>
            {copied?<Check className="mr-2 size-4"/>:<ClipboardCopy className="mr-2 size-4"/>}
            {copied?"Copied":"Copy API key"}
          </Button>
          {isCopyError && <p className="text-xs">Automatic copy was blocked; select the key above and copy it manually.</p>}
          <p className="text-xs">Allowed source: <strong>{issued.source_system}</strong> · Facility: <strong>{issued.facility_code}</strong></p>
          <Button className="w-full" variant="secondary" onClick={()=>setIssued(null)}>I saved the key</Button>
        </div>}

        {showForm && !issued && <form onSubmit={event=>{event.preventDefault();register.mutate();}} className="space-y-4 rounded-xl border bg-muted/30 p-4">
          <p className="font-semibold">Connect a new system</p>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">System name</span>
            <input className="w-full rounded-lg border bg-background px-3 py-2.5" required minLength={3} maxLength={100}
              value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Hospital monitoring gateway"/>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Source identifier</span>
            <input className="w-full rounded-lg border bg-background px-3 py-2.5" required minLength={2} maxLength={100}
              value={source} onChange={e=>setSource(e.target.value)} placeholder="e.g. Hospital-A-LIS"/>
            <span className="block text-xs text-muted-foreground">External events must use exactly this source identifier.</span>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Allowed facility code</span>
            <input className="w-full rounded-lg border bg-background px-3 py-2.5" required minLength={2} maxLength={80}
              value={facility} onChange={e=>setFacility(e.target.value)} placeholder="e.g. HSP-028"/>
            <span className="block text-xs text-muted-foreground">This key cannot send or retrieve cases from other facilities.</span>
          </label>
          {register.isError && <p role="alert" className="text-sm text-destructive">{register.error.message}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={register.isPending}>{register.isPending?"Generating…":"Generate API key"}</Button>
            <Button variant="outline" type="button" onClick={()=>setShowForm(false)}>Cancel</Button>
          </div>
        </form>}

        {connections.isPending && <p role="status" className="text-sm text-muted-foreground">Loading connections…</p>}
        {connections.isError && <p role="alert" className="text-sm text-destructive">{connections.error.message}</p>}
        {connections.data?.items.length===0 && !showForm && !issued && <div className="rounded-lg border border-dashed p-5 text-center">
          <Cable className="mx-auto mb-2 size-6 text-muted-foreground"/>
          <p className="text-sm font-medium">No external systems connected yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a connector key to onboard your first system.</p>
        </div>}
        {connections.data?.items.map(conn=><div key={conn.id} className="rounded-xl border p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{conn.label}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{conn.source_system} · {conn.facility_code}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${conn.revoked?"bg-red-50 text-red-800":conn.last_observation_at?"bg-green-50 text-green-800":"bg-slate-100 text-slate-700"}`}>
              {conn.revoked?"Revoked":conn.last_observation_at?"Data received":"Awaiting data"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Key: {conn.key_prefix} · {conn.last_observation_at?"Latest observation received":"No observations received"}</p>
            {!conn.revoked && <Button variant="outline" size="sm" disabled={revoke.isPending}
              onClick={()=>{if(window.confirm(`Revoke access for ${conn.label}? Existing case history will remain.`))revoke.mutate(conn.id);}}>
              <Trash2 className="mr-1 size-3.5"/> Revoke
            </Button>}
          </div>
        </div>)}
        {revoke.isError && <p role="alert" className="text-sm text-destructive">{revoke.error.message}</p>}
      </CardContent>
    </Card>}

    {user.data && !isSupervisor && <div className="rounded-xl border bg-card p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="size-4"/> Connector administration</div>
      <p className="mt-2 text-muted-foreground">A Quality Supervisor creates and revokes system credentials. As a Facility Operator, you can investigate imported incidents or use the sample feed below.</p>
    </div>}

    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="size-4"/> Integration endpoints</div>
        <CardTitle className="text-lg">Connect your application</CardTitle>
        <p className="text-sm text-muted-foreground">Use your generated key in the `X-TrustLedger-Connector-Key` request header. Both directions require authentication.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Send an observation · POST</p>
          <p className="mt-1 break-all font-mono text-xs">{receiveUrl}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={()=>void copy(receiveUrl)}><ClipboardCopy className="mr-1 size-3.5"/> Copy URL</Button>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Read case updates · GET</p>
          <p className="mt-1 break-all font-mono text-xs">{outgoingUrl}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={()=>void copy(outgoingUrl)}><ClipboardCopy className="mr-1 size-3.5"/> Copy URL</Button>
        </div>
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Example request format</summary>
          <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-white">{JSON.stringify({
            schema_version:"trustledger.observation.v1",
            source_system:issued?.source_system??"Hospital-A-LIS",
            source_event_id:"unique-reading-001",
            facility_id:issued?.facility_code??"HSP-028",
            observed_at:"2026-11-11T06:00:00+01:00",
            temperature_c:7.2,
          },null,2)}</pre>
          <p className="mt-2 text-xs text-muted-foreground">Include a unique source event ID and the original timezone-aware timestamp. Repeat deliveries are safe. Four consecutive qualifying hourly observations create an investigation candidate.</p>
        </details>
        <p className="text-xs text-muted-foreground">This is a working scoped JSON/HTTPS adapter, not a certified ABBIS, HL7 or FHIR connector. Outgoing case updates use authenticated polling; push webhooks are not yet enabled. Use the production domain when it is released.</p>
      </CardContent>
    </Card>
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="font-semibold">Test with sample data</p><p className="mt-1 text-sm text-muted-foreground">Optional synthetic replay. Not required to connect a real system.</p></div>
        <Button variant="outline" onClick={()=>router.push("/connections/sandbox")}>Try demo</Button>
      </div>
    </div>
  </div>;
}
