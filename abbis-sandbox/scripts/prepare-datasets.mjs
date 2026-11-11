import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { parse } from "csv-parse";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const root=process.cwd();
const manifest=JSON.parse(await fs.readFile(path.join(root,"data/source-manifest.json"),"utf8"));
const folder=path.join(root,"data/raw");
await fs.mkdir(folder,{recursive:true});
const summaries=[];
const sourceFacility="HSP-028";
const sourceId="ABBIS-SANDBOX";
const facilityReadings=[];
for(const file of manifest.synthetic_csv_inputs){
  const filename=path.basename(file.path);
  const target=path.join(folder,filename);
  let buffer;
  try{buffer=await fs.readFile(target)}catch{buffer=null;}
  function matches(data){
    return data && data.length===file.bytes &&
      crypto.createHash("sha1").update(Buffer.concat([
        Buffer.from("blob "+data.length+"\0"),data
      ])).digest("hex")===file.git_sha1;
  }
  if(!matches(buffer)){
    const url="https://raw.githubusercontent.com/"+manifest.source_repository+"/"+
      manifest.source_revision+"/"+file.path;
    const response=await fetch(url,{signal:AbortSignal.timeout(120000),headers:{"User-Agent":"ABBIS-sandbox-pinned-source"}});
    if(!response.ok)throw Error("Could not fetch pinned source "+filename+" (HTTP "+response.status+")");
    buffer=Buffer.from(await response.arrayBuffer());
    if(!matches(buffer))throw Error("Pinned source hash mismatch for "+filename);
    await fs.writeFile(target,buffer);
  }
  const text=buffer.toString("utf8");
  const parsed=Readable.from([text]).pipe(parse({columns:true,skip_empty_lines:true,bom:true,relax_quotes:false}));
  let count=0;
  let columns=[];
  const examples=[];
  for await(const row of parsed){
    count++;
    if(count===1)columns=Object.keys(row);
    if(examples.length<2)examples.push(row);
    if(filename==="temperature_logs.csv" && row.facility_id===sourceFacility){
      const temperature=Number(row.temp_c);
      const observedAt=String(row.recorded_at??"").trim();
      if(Number.isFinite(temperature) && ![0,-99,99.9].includes(temperature) &&
       /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(observedAt)){
        facilityReadings.push({temperature_c:temperature,recorded_at:observedAt});
      }
    }
  }
  summaries.push({id:filename.replace(".csv",""),filename,count,columns,bytes:file.bytes,git_sha1:file.git_sha1});
  console.log("Pinned ABBIS dataset verified:",filename,count+" records");
}
facilityReadings.sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at));
const used=new Set();
const episodes=[];
for(let i=0;i<=facilityReadings.length-4;i++){
  const window=facilityReadings.slice(i,i+4);
  if(window.some(x=>!(x.temperature_c>6&&x.temperature_c<80)))continue;
  const times=window.map(x=>new Date(x.recorded_at.replace(" ","T")+"Z"));
  if(times.some(x=>!Number.isFinite(x.getTime())))continue;
  if(times.slice(1).some((x,j)=>x-times[j]!==3600000))continue;
  const identity=window.map(x=>x.recorded_at).join("|");
  if(used.has(identity))continue;
  if(episodes.length && new Date(window[0].recorded_at.replace(" ","T")+"Z")<=
    new Date(episodes.at(-1).at(-1).observed_at))continue;
  const chunk=window.map((x)=>{
    const observed_at=x.recorded_at.replace(" ","T")+"+00:00";
    const slug=x.recorded_at.replace(/\D/g,"").slice(0,12);
    return {schema_version:"trustledger.observation.v1",source_system:sourceId,
      source_event_id:"SRC-"+sourceFacility+"-"+slug,
      facility_id:sourceFacility,observed_at,temperature_c:x.temperature_c};
  });
  episodes.push(chunk);
  used.add(identity);
  i+=3;
  if(episodes.length>=120)break;
}
if(!episodes.length)throw Error("No independently sourced four-hour excursion sequence found for "+sourceFacility);
const catalog={source:manifest.source_repository,source_revision:manifest.source_revision,
  facility_id:sourceFacility,source_system:sourceId,
  replay_interval_seconds:60,
  dataset_summaries:summaries,
  episode_count:episodes.length,
  episodes,
  timestamp_note:"The original CSV readings did not specify a timezone; UTC is assigned for synthetic replay only.",
  generated_at:new Date().toISOString()};
await fs.writeFile(path.join(root,"data/catalog.json"),JSON.stringify(catalog,null,2)+"\n");
console.log("AUTOMATIC_ABBIS_CATALOG="+JSON.stringify({episodes:episodes.length,facility:sourceFacility,datasets:summaries.map(x=>[x.filename,x.count])}));
