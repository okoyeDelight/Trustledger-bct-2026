import {NextRequest} from "next/server";
import {catalog} from "@/lib/catalog";
import {originAllowed,readConnection,saveConnection,safeMessage,trustLedgerRequest} from "@/lib/integration";
import {answer,rejection} from "@/lib/responses";

export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:NextRequest){
 if(!originAllowed(request))return rejection("Invalid source session origin.",403);
 const connection=await readConnection();
 if(!connection)return rejection("Connect the blood-bank source to TrustLedger first.",401);
 let catalogData;
 try{catalogData=await catalog();}catch{return rejection("Source catalog not available.",503);}
 if(connection.source_system!==catalogData.source_system||connection.facility_code!==catalogData.facility_id)
   return rejection("The connected API key is not authorized for this source facility.",403);

 const cursor=Math.max(0,Math.floor(connection.cursor??0));
 if(cursor>=catalogData.episodes.length)
   return answer({finished:true,cursor,total:catalogData.episodes.length,
     message:"All verified source episodes for this facility have been delivered. No artificial incidents will be invented."});
 const episode=catalogData.episodes[cursor];
 const receipts:{source_event_id:string;status:string;observation_stored:boolean;case_reference:string|null}[]=[];
 for(const observation of episode){
   let result;
   try{result=await trustLedgerRequest("/api/connectors/v1/observations",connection.key,"POST",observation);}
   catch{return answer({success:false,cursor,receipts,message:"Network delivery interrupted. Next tick can safely retry the same source events."},502);}
   if(result.status!==200 && result.status!==201){
     return answer({success:false,cursor,receipts,message:safeMessage(result),http_status:result.status},502);
   }
   const ack=result.data as {source_event_id:string;status:string;observation_stored:boolean;case_reference:string|null};
   receipts.push({source_event_id:ack.source_event_id,status:ack.status,observation_stored:ack.observation_stored,case_reference:ack.case_reference});
 }
 await saveConnection({...connection,cursor:cursor+1});
 return answer({success:true,finished:cursor+1>=catalogData.episodes.length,cursor:cursor+1,
   total:catalogData.episodes.length,receipts,
   case_reference:receipts.findLast(x=>x.case_reference)?.case_reference??null,
   received_events:receipts.length,
   notice:"Historical synthetic observations delivered over the real adapter, not live medical-device telemetry."});
}
