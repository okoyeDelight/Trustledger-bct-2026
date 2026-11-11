import {createReadStream} from "node:fs";
import path from "node:path";
import {parse} from "csv-parse";
import {catalog} from "@/lib/catalog";
import {answer,rejection} from "@/lib/responses";

export const runtime="nodejs";
export async function GET(req:Request,context:{params:Promise<{name:string}>}){
 const {name}=await context.params;
 let c;
 try{c=await catalog();}catch{return rejection("ABBIS source dataset is unavailable.",503);}
 const entry=c.dataset_summaries.find(x=>x.id===name);
 if(!entry)return rejection("Dataset was not found.",404);
 const url=new URL(req.url);
 const offset=Math.min(500000,Math.max(0,Number(url.searchParams.get("offset")||0)||0));
 const limit=Math.min(25,Math.max(1,Number(url.searchParams.get("limit")||10)||10));
 const rows:Record<string,string>[]=[];
 let seen=0;
 try{
   const stream=createReadStream(path.join(process.cwd(),"data/raw",entry.filename));
   const parser=stream.pipe(parse({columns:true,skip_empty_lines:true,bom:true}));
   for await(const row of parser){
     if(seen>=offset && rows.length<limit)rows.push(row as Record<string,string>);
     seen++;
     if(rows.length>=limit){stream.destroy();break;}
   }
 }catch{return rejection("Source dataset could not be read.",503);}
 return answer({name,source_revision:c.source_revision,total:entry.count,offset,items:rows});
}
