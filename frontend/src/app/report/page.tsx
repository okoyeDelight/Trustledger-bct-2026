"use client";

import {useDeferredValue, useState, type FormEvent} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useRouter} from "next/navigation";
import {ClipboardPenLine, ShieldAlert} from "lucide-react";
import {PageHeading} from "@/components/page-heading";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {createStaffIncident, fetchCurrentUser, fetchABBISCatalog, searchABBISSource} from "@/lib/api";
import type {ABBISSourceRecord} from "@/lib/api";
import type {StaffReportRequest} from "@/lib/types";

const categories: {value: StaffReportRequest["category"]; title: string}[] = [
  {value:"equipment_problem",title:"Equipment problem"},
  {value:"monitoring_gap",title:"Missing monitoring records"},
  {value:"temperature_excursion",title:"Observed temperature concern"},
  {value:"sensor_anomaly",title:"Sensor or logger anomaly"},
  {value:"other",title:"Other observation"},
];

function localDateMinute(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 16);
}

export default function ReportIncidentPage(){
  const router=useRouter();
  const client=useQueryClient();
  const identity=useQuery({queryKey:["current-user"],queryFn:fetchCurrentUser});
  const [sourceDataset,setSourceDataset]=useState("facilities");
  const [search,setSearch]=useState("");
  const deferredSearch=useDeferredValue(search);
  const [selected,setSelected]=useState<ABBISSourceRecord|null>(null);
  const abbis=useQuery({queryKey:["abbis-catalog"],queryFn:fetchABBISCatalog,retry:false});
  const matching=useQuery({
    queryKey:["abbis-search",sourceDataset,deferredSearch],
    queryFn:()=>searchABBISSource(sourceDataset,deferredSearch),
    enabled:abbis.isSuccess&&!selected&&deferredSearch.trim().length>=2,
    retry:false,
  });
  const [facilityCode,setFacilityCode]=useState("");
  const [category,setCategory]=useState<StaffReportRequest["category"]>("equipment_problem");
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [observed,setObserved]=useState("");
  const [maxObserved,setMaxObserved]=useState("");
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
    if(parsed.getTime() > Date.now() + 5 * 60_000){
      setNotice("The observation date is in the future. Please check the day, month and year.");
      return;
    }
    create.mutate({
      facility_code:facilityCode.trim().toUpperCase(),category,title:title.trim(),
      description:description.trim(),observed_at:parsed.toISOString(),
      ...(selected?{source_dataset:selected.dataset,source_record_id:selected.record_id,source_record_sha256:selected.record_sha256}:{}) ,
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
            <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
              <p className="font-semibold">Select evidence from ABBIS</p>
              <p className="text-xs leading-5 text-muted-foreground">Search all 11 original hackathon datasets. Selecting a record fills its facility ID and attaches its verified source reference. You can also file an independent observation.</p>
              {abbis.isPending&&<p className="text-xs">Loading source datasets…</p>}
              {abbis.isError&&<p role="alert" className="text-xs text-red-800">ABBIS source search is temporarily unavailable. Manual staff reporting remains possible.</p>}
              {abbis.data&&!selected&&<>
                <label className="block space-y-2 text-sm font-medium">Dataset
                  <select aria-label="Dataset" value={sourceDataset}
                    onChange={e=>{setSourceDataset(e.target.value);setSearch("");}}
                    className="w-full rounded-lg border bg-white px-3 py-2.5">
                    {abbis.data.datasets.map(d=><option value={d.id} key={d.id}>{d.id.replaceAll("_"," ")} ({d.count.toLocaleString("en-GB")})</option>)}
                  </select>
                </label>
                <label className="block space-y-2 text-sm font-medium">Type an ID or facility name
                  <Input placeholder="e.g. HSP-028 or unit ID" value={search} autoComplete="off" onChange={e=>setSearch(e.target.value)}/>
                </label>
                {matching.isFetching&&<p className="text-xs text-muted-foreground">Searching actual source records…</p>}
                {matching.isError&&<p role="alert" className="text-xs text-red-800">Could not search ABBIS right now.</p>}
                {matching.data&&<div className="max-h-64 space-y-2 overflow-y-auto" aria-label="Matching source records">
                  {matching.data.items.map(item=><button key={item.record_id} type="button"
                    disabled={!item.facility_id}
                    onClick={()=>{setSelected(item);setFacilityCode(item.facility_id??"");setTitle(t=>t||"Investigate "+item.dataset.replaceAll("_"," ")+" record");}}
                    className="w-full rounded-lg border bg-white p-3 text-left text-sm hover:border-sky-600 disabled:opacity-50">
                    <strong className="block break-all">{item.record_id}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.summary}</span>
                    <span className="mt-1 block text-xs">Facility: {item.facility_id??"Not recorded"}</span>
                  </button>)}
                  {matching.data.items.length===0&&<p className="py-2 text-xs">No matching records found.</p>}
                </div>}
              </>}
              {selected&&<div className="rounded-lg border border-emerald-300 bg-white p-3 text-sm">
                <p className="font-semibold text-emerald-900">Original ABBIS record selected</p>
                <p className="mt-1 break-all">{selected.dataset} / {selected.record_id}</p>
                <p className="mt-1 text-xs">{selected.summary}</p>
                <Button type="button" size="sm" variant="outline" className="mt-3"
                  onClick={()=>{setSelected(null);setSearch("");setFacilityCode("");}}>Choose another</Button>
              </div>}
            </div>
            <label className="block space-y-2 text-sm font-medium">
              Synthetic facility code
              <Input required placeholder="e.g. HSP-024" value={facilityCode} readOnly={!!selected}
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
              <Input type="datetime-local" required value={observed} max={maxObserved || undefined}
                onFocus={()=>{
                  const current = localDateMinute(new Date());
                  setMaxObserved(current);
                  setObserved(value => value || current);
                }}
                onChange={e=>setObserved(e.target.value)}/>
              <span className="block text-xs font-normal text-muted-foreground">
                Tap this field to prefill your current local date and time, or select an earlier observation.
              </span>
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
