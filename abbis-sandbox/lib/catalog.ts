import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

export type Observation={schema_version:"trustledger.observation.v1";source_system:string;source_event_id:string;facility_id:string;observed_at:string;temperature_c:number};
export type Dataset={id:string;filename:string;count:number;columns:string[];bytes:number;git_sha1:string};
export type Catalog={
 source:string;source_revision:string;facility_id:string;source_system:string;timestamp_note:string;
 replay_interval_seconds:number;episode_count:number;
 dataset_summaries:Dataset[];
 episodes:Observation[][];
 generated_at:string;
};
export async function catalog():Promise<Catalog>{
 const file=path.join(process.cwd(),"data/catalog.json");
 const parsed=JSON.parse(await fs.readFile(file,"utf8")) as Catalog;
 if(!Array.isArray(parsed.episodes)||!parsed.episodes.length||parsed.dataset_summaries.length!==6)
   throw Error("ABBIS source catalog is unavailable or incomplete");
 return parsed;
}
