"use client";

import {useState, type FormEvent} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useRouter} from "next/navigation";
import {ClipboardPenLine, ShieldAlert} from "lucide-react";
import {PageHeading} from "@/components/page-heading";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {createStaffIncident, fetchCurrentUser} from "@/lib/api";
import type {StaffReportRequest} from "@/lib/types";

const categories: {value: StaffReportRequest["category"]; title: string}[] = [
  {value:"equipment_problem",title:"Equipment problem"},
  {value:"monitoring_gap",title:"Missing monitoring records"},
  {value:"temperature_excursion",title:"Observed temperature concern"},
  {value:"sensor_anomaly",title:"Sensor or logger anomaly"},
  {value:"other",title:"Other observation"},
];

export default function ReportIncidentPage(){
  const router=useRouter();
  const client=useQueryClient();
  const identity=useQuery({queryKey:["current-user"],queryFn:fetchCurrentUser});
  const [facilityCode,setFacilityCode]=useState("");
  const [category,setCategory]=useState<StaffReportRequest["category"]>("equipment_problem");
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [observed,setObserved]=useState("");
  const [notice,setNotice]=useState("");
  const create=useMutation({
    mutationFn:createStaffIncident,
    onSuccess:async(result)=>{
      await client.invalidateQueries({queryKey:["incidents"]});
      setNotice("Incident saved to the shared record.");
      router.push("/incidents/"+encodeURIComponent(result.incident.incident_id));
    },
  });
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setNotice("");
    const parsed=new Date(observed);
    if(!Number.isFinite(parsed.getTime())){
      setNotice("Enter a valid date and time for the observation.");
      return;
    }
    create.mutate({
      facility_code:facilityCode.trim().toUpperCase(),category,title:title.trim(),
      description:description.trim(),observed_at:parsed.toISOString(),
    });
  }
  const canReport=identity.data?.role==="facility_staff";
  return <>
    <PageHeading eyebrow="Human observations · synthetic pilot" title="Report an incident"
      description="A worker can record an issue even when the monitoring system did not detect one. This is an observation, not verified evidence of blood-unit exposure."/>
    <div className="max-w-2xl">
      <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <ShieldAlert className="mt-0.5 size-5 shrink-0"/>
        <p>Use <strong>synthetic facility names and records only</strong>. Do not enter patient, donor or actual operational details. A separate supervisor must review a submitted investigation.</p>
      </div>
      {identity.isPending && <p className="text-sm text-muted-foreground">Checking staff permissions…</p>}
      {identity.data&&!canReport&&
        <Card><CardContent className="p-6 text-sm">Only the facility staff account can submit an incident report. Sign in as the operator to try this workflow.</CardContent></Card>}
      {canReport&&<Card className="border-0 shadow-sm ring-1 ring-border/80">
        <CardHeader><CardTitle>What did you observe?</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <label className="block space-y-2 text-sm font-medium">
              Synthetic facility code
              <Input required placeholder="e.g. HSP-024" value={facilityCode}
                maxLength={80} pattern="[A-Za-z0-9_-]+" minLength={2}
                onChange={e=>setFacilityCode(e.target.value)}/>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Category
              <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={category} onChange={e=>setCategory(e.target.value as StaffReportRequest["category"])}>
                {categories.map(item=><option key={item.value} value={item.value}>{item.title}</option>)}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Short title
              <Input required minLength={5} maxLength={160}
                placeholder="Describe the equipment or evidence problem"
                value={title} onChange={e=>setTitle(e.target.value)}/>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Date and time observed (your local time)
              <Input type="datetime-local" required value={observed} onChange={e=>setObserved(e.target.value)}/>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              What happened? What is still unknown?
              <textarea className="min-h-32 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                minLength={10} maxLength={3000} required
                placeholder="Describe what was actually observed, not what you assume happened."
                value={description} onChange={e=>setDescription(e.target.value)}/>
            </label>
            {notice&&<p role="status" className="text-sm">{notice}</p>}
            {create.isError&&<p role="alert" className="text-sm text-destructive">{create.error.message}</p>}
            <Button disabled={create.isPending} type="submit">
              <ClipboardPenLine aria-hidden="true"/>{create.isPending?"Saving…":"Submit incident"}
            </Button>
          </form>
        </CardContent>
      </Card>}
    </div>
  </>;
}
