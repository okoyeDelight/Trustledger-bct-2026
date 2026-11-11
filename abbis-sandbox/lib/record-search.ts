import "server-only";
import {createReadStream} from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {parse} from "csv-parse";
import {catalog} from "@/lib/catalog";

const ids: Record<string,string[]> = {
  facilities:["facility_id"],
  routes:["from_facility_id","to_facility_id"],
  donors:["donor_id"],
  drives:["drive_id"],
  donations:["donation_id"],
  units:["unit_id"],
  transfers:["transfer_id"],
  requests:["request_id"],
  daily_stock:["date","facility_id","component","blood_group"],
  power_outages:["outage_id"],
  temperature_logs:["facility_id","recorded_at"],
};
const timestamps: Record<string,string> = {
  drives:"date", donations:"collection_date", units:"collection_date",
  transfers:"dispatched_at",requests:"requested_at",daily_stock:"date",
  power_outages:"start_time",temperature_logs:"recorded_at",
};
const facilityFields:Record<string,string[]> = {
  facilities:["facility_id"],routes:["from_facility_id"],donors:["registration_site_id"],
  drives:["collecting_site_id"],donations:["collecting_site_id"],
  units:["current_facility_id","processed_at_id"],transfers:["from_facility_id"],
  requests:["facility_id"],daily_stock:["facility_id"],power_outages:["facility_id"],
  temperature_logs:["facility_id"],
};
// Only these human-facing columns are returned to avoid unnecessarily
// exposing fields such as synthetic birth dates or patient descriptors.
const displayFields:Record<string,string[]> = {
  facilities:["name","facility_type","county"],
  routes:["from_facility_id","to_facility_id","road_km"],
  donors:["blood_group","donor_category"],
  drives:["date","collecting_site_id","venue_type"],
  donations:["collection_date","outcome","collecting_site_id"],
  units:["component","blood_group","current_facility_id","status"],
  transfers:["unit_id","from_facility_id","to_facility_id","coolbox_max_temp_c"],
  requests:["facility_id","component_requested","urgency","outcome"],
  daily_stock:["date","facility_id","component","blood_group","units_in_stock_end_of_day"],
  power_outages:["facility_id","start_time","backup_power_engaged"],
  temperature_logs:["facility_id","recorded_at","temp_c"],
};
export type SourceRecordSummary={
  dataset:string;record_id:string;facility_id:string|null;
  summary:string;observed_at:string|null;record_sha256:string;
  source_system:"ABBIS-SANDBOX";source_revision:string;
};
export function idFor(dataset:string,row:Record<string,string>):string {
  const keys=ids[dataset];
  if(!keys)throw Error("Unknown organizer dataset");
  const parts=keys.map(key=>(row[key]??"").trim());
  if(parts.some(part=>!part))return "";
  return parts.join(" | ");
}
function hashRow(row:Record<string,string>):string {
  return crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex");
}
function facilityFor(dataset:string,row:Record<string,string>):string|null{
  for(const key of facilityFields[dataset]??[]){
    if(row[key])return row[key].trim();
  }
  return null;
}
function summaryFor(dataset:string,row:Record<string,string>):string{
  return (displayFields[dataset]??[])
    .map(key=>row[key]?.trim()).filter(Boolean).join(" · ").slice(0,200);
}
function snapshot(dataset:string,row:Record<string,string>,revision:string):SourceRecordSummary {
  return {
    dataset,record_id:idFor(dataset,row),facility_id:facilityFor(dataset,row),
    summary:summaryFor(dataset,row),observed_at:row[timestamps[dataset]]?.trim()??null,
    record_sha256:hashRow(row),source_system:"ABBIS-SANDBOX",source_revision:revision,
  };
}
/** Search the complete pinned CSV, not merely the 4-row demo fixture. */
export async function searchSourceRecords(dataset:string,query:string,limit=15,exact=false){
  const c=await catalog();
  const entry=c.dataset_summaries.find(x=>x.id===dataset);
  if(!entry || !ids[dataset])throw Error("Unknown organizer dataset");
  const normalized=query.trim().toLowerCase();
  if(normalized.length<2 && !exact) return {items:[],total:entry.count};
  if(!normalized || normalized.length>180)throw Error("Invalid source lookup");
  const rows:SourceRecordSummary[]=[];
  const safeLimit=Math.min(30,Math.max(1,limit));
  const stream=createReadStream(path.join(process.cwd(),"data/raw",entry.filename));
  const parser=stream.pipe(parse({columns:true,skip_empty_lines:true,bom:true}));
  try{
    for await(const raw of parser){
      const row=raw as Record<string,string>;
      const id=idFor(dataset,row);
      if(!id)continue;
      const candidate=snapshot(dataset,row,c.organizer_archive_sha256);
      if(exact ? id===query : (
        id.toLowerCase().includes(normalized) ||
        candidate.facility_id?.toLowerCase().includes(normalized) ||
        candidate.summary.toLowerCase().includes(normalized)
      )){
        rows.push(candidate);
      }
      if(rows.length>=safeLimit)break;
    }
  }finally{
    // Stream destruction after an early hit avoids reading huge stock files
    // further than necessary. The iterator handles closure on break.
    stream.destroy();
  }
  return {items:rows,total:entry.count,dataset,source_revision:c.organizer_archive_sha256};
}
