"use client";

import Link from "next/link";
import {useState, type FormEvent} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {ClipboardCheck, ListTodo, ShieldAlert} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {ErrorState, LoadingState} from "@/components/query-states";
import {
  closeInvestigation, completeCaseFollowup, createCaseFollowup,
  fetchCaseWorkflow, submitInvestigation,
} from "@/lib/api";
import type {AuthenticatedUser, CaseWorkflow} from "@/lib/types";
import {formatDateTime} from "@/lib/date";

const statuses: Record<CaseWorkflow["status"],string> = {
  investigating:"Investigating",
  awaiting_review:"Awaiting supervisor review",
  returned:"Returned for evidence",
  followup:"Follow-up",
  closed:"Administratively closed",
};
const events: Record<string,string> = {
  investigation_submitted:"Worker submitted investigation",
  review_accepted:"Supervisor accepted investigation flag",
  review_returned:"Supervisor requested more evidence",
  review_rejected:"Supervisor rejected investigation flag",
  followup_created:"Follow-up assigned",
  followup_completed:"Follow-up completed",
  case_closed:"Administrative case closure",
};

export function CaseWorkflowPanel({caseId, user, findingCount}:{
  caseId:string;user?:AuthenticatedUser;findingCount:number;
}){
  const client=useQueryClient();
  const [summary,setSummary]=useState("");
  const [description,setDescription]=useState("");
  const [due,setDue]=useState("");
  const [closureReason,setClosureReason]=useState("");
  const [completionNotes,setCompletionNotes]=useState<Record<string,string>>({});
  const [notice,setNotice]=useState("");
  const workflow=useQuery({
    queryKey:["case-workflow",caseId],
    queryFn:()=>fetchCaseWorkflow(caseId),
    enabled:Boolean(caseId),
    retry:false,
  });
  async function refresh(){
    await Promise.all([
      client.invalidateQueries({queryKey:["case-workflow",caseId]}),
      client.invalidateQueries({queryKey:["review-queue"]}),
      client.invalidateQueries({queryKey:["audit-log"]}),
    ]);
  }
  const submit=useMutation({
    mutationFn:()=>submitInvestigation(caseId,summary.trim()),
    onSuccess:async()=>{setSummary("");setNotice("Investigation submitted to the supervisor.");await refresh();},
  });
  const followup=useMutation({
    mutationFn:()=>createCaseFollowup(
      caseId, description.trim(),due?new Date(due).toISOString():null
    ),
    onSuccess:async()=>{setDescription("");setDue("");setNotice("Follow-up assigned.");await refresh();},
  });
  const complete=useMutation({
    mutationFn:(actionId:string)=>completeCaseFollowup(
      caseId,actionId,(completionNotes[actionId]||"").trim()
    ),
    onSuccess:async()=>{setCompletionNotes({});setNotice("Follow-up completion recorded.");await refresh();},
  });
  const close=useMutation({
    mutationFn:()=>closeInvestigation(caseId,closureReason.trim()),
    onSuccess:async()=>{setClosureReason("");setNotice("Administrative closure saved. This does not authorize blood release.");await refresh();},
  });

  const state=workflow.data;
  const operator=user?.role==="facility_staff";
  const supervisor=user?.role==="blood_service_supervisor";
  const openActions=state?.followups.filter(a=>a.status==="open")||[];
  function submitReport(e:FormEvent){e.preventDefault();setNotice("");submit.mutate();}
  function assign(e:FormEvent){e.preventDefault();setNotice("");followup.mutate();}
  function confirmClosure(e:FormEvent){e.preventDefault();setNotice("");close.mutate();}

  return <Card className="mt-6 border-0 shadow-sm ring-1 ring-border/80">
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Investigation workflow</CardTitle>
        {state&&<Badge variant="outline">{statuses[state.status]}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">
        Worker findings → independent review → assigned follow-up → documented administrative closure.
      </p>
    </CardHeader>
    <CardContent className="space-y-5">
      {workflow.isPending&&<LoadingState label="Loading case status…"/>}
      {workflow.isError&&<ErrorState message={workflow.error.message} onRetry={()=>void workflow.refetch()}/>}
      {state&&<>
        {state.status==="investigating"&&<p className="text-sm text-muted-foreground">
          This case has not yet been submitted for supervisor review. Record the evidence you checked and submit your assessment.
        </p>}
        {state.status==="returned"&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          A supervisor requested more evidence. Add a <strong>new investigation finding</strong> addressing their feedback before resubmitting.
        </p>}
        {state.status==="awaiting_review"&&<p className="rounded-lg border bg-muted/40 p-3 text-sm">
          Submitted by {state.submitted_by}. The investigation is locked for changes until the supervisor reviews it.
          {supervisor&&<> <Link href={"/review?case="+encodeURIComponent(caseId)} className="ml-1 font-semibold text-primary underline">Open review centre</Link></>}
        </p>}
        {operator&&["investigating","returned"].includes(state.status)&&
          <form onSubmit={submitReport} className="space-y-3">
            <label htmlFor="investigation-summary" className="block text-sm font-medium">
              Submit findings for supervisor review
            </label>
            <textarea id="investigation-summary" minLength={10} maxLength={2000} required
              value={summary} onChange={e=>setSummary(e.target.value)}
              className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm"
              placeholder="Summarize what is confirmed, what is unknown and what action you recommend."/>
            {findingCount===0&&<p className="text-xs text-amber-700">Save at least one investigation finding first.</p>}
            {submit.isError&&<p role="alert" className="text-sm text-destructive">{submit.error.message}</p>}
            <Button disabled={submit.isPending||summary.trim().length<10||findingCount===0} type="submit">
              <ClipboardCheck className="size-4" aria-hidden="true"/>
              {submit.isPending?"Submitting…":"Submit to supervisor"}
            </Button>
          </form>}
        {state.status==="followup"&&<>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ListTodo className="size-4 text-primary"/>Actions and follow-up
          </div>
          {!state.followups.length&&<p className="text-sm text-muted-foreground">
            No specific follow-up action has been assigned. The supervisor can add one or record an administrative closure reason.
          </p>}
          {state.followups.map(action=><div key={action.action_id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">{action.description}</strong>
              <Badge variant="outline">{action.status==="open"?"Open":"Completed"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Assigned to {action.owner_username}{action.due_at?" · Due "+formatDateTime(action.due_at):""}
            </p>
            {action.status==="done"&&<p className="text-sm">
              Completion: {action.completion_note}
            </p>}
            {operator&&action.status==="open"&&user?.username===action.owner_username&&
              <form className="space-y-2" onSubmit={e=>{e.preventDefault();complete.mutate(action.action_id);}}>
                <label htmlFor={"completion-"+action.action_id} className="block text-sm font-medium">Work completed and supporting evidence</label>
                <textarea id={"completion-"+action.action_id} required minLength={10} maxLength={2000}
                  value={completionNotes[action.action_id]||""}
                  onChange={e=>setCompletionNotes({...completionNotes,[action.action_id]:e.target.value})}
                  className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="Record what you did and where the evidence can be checked."/>
                {complete.isError&&<p role="alert" className="text-sm text-destructive">{complete.error.message}</p>}
                <Button variant="outline" type="submit" disabled={complete.isPending||(completionNotes[action.action_id]||"").trim().length<10}>
                  Mark follow-up completed
                </Button>
              </form>}
          </div>)}
          {supervisor&&<>
            <form onSubmit={assign} className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <label htmlFor="followup-description" className="block text-sm font-medium">Assign a follow-up to facility staff</label>
              <textarea id="followup-description" required minLength={10} maxLength={1000}
                value={description} onChange={e=>setDescription(e.target.value)}
                className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="Action required, equipment/source to check, and expected proof."/>
              <label htmlFor="followup-due" className="block text-sm font-medium">Due date (optional, local time)</label>
              <Input id="followup-due" type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/>
              {followup.isError&&<p role="alert" className="text-sm text-destructive">{followup.error.message}</p>}
              <Button disabled={followup.isPending||description.trim().length<10} type="submit">
                {followup.isPending?"Assigning…":"Assign follow-up"}
              </Button>
            </form>
            <form onSubmit={confirmClosure} className="space-y-3 rounded-lg border p-3">
              <label htmlFor="closure-reason" className="block text-sm font-medium">Administrative closure reason</label>
              <textarea id="closure-reason" required minLength={10} maxLength={2000}
                value={closureReason} onChange={e=>setClosureReason(e.target.value)}
                className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="Explain why investigation work is finished and note any unresolved clinical question."/>
              <p className="text-xs text-muted-foreground">
                {openActions.length?openActions.length+" open follow-up(s) must be finished before closure.":"All assigned actions are complete or none were assigned."}
              </p>
              {close.isError&&<p role="alert" className="text-sm text-destructive">{close.error.message}</p>}
              <Button variant="outline" type="submit" disabled={close.isPending||openActions.length>0||closureReason.trim().length<10}>
                {close.isPending?"Recording…":"Close investigation administratively"}
              </Button>
            </form>
          </>}
        </>}
        {state.status==="closed"&&<p className="rounded-lg border p-3 text-sm">
          Investigation administratively closed. This does not mean the blood units were clinically cleared, released, discarded or found safe.
        </p>}
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Case activity history ({state.events.length})</summary>
          <ol className="mt-3 space-y-3">
            {state.events.map(e=><li key={e.id} className="border-t pt-3">
              <p className="font-medium">{events[e.event_kind]||e.event_kind}</p>
              <p className="text-xs text-muted-foreground">{e.actor_name} · {formatDateTime(e.created_at)}</p>
              {typeof e.details.summary==="string"&&<p>{e.details.summary}</p>}
              {typeof e.details.reason==="string"&&<p>{e.details.reason}</p>}
              {typeof e.details.changed_assessment==="string"&&<p>{e.details.changed_assessment}</p>}
            </li>)}
          </ol>
        </details>
      </>}
      {notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
      <div className="flex gap-2 border-t pt-3 text-xs text-muted-foreground">
        <ShieldAlert className="size-4 shrink-0"/>
        <p>This workflow tracks investigation and administrative outcomes only; it does not make blood safety or clinical release decisions.</p>
      </div>
    </CardContent>
  </Card>;
}
