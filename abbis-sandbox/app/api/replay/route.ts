import {NextRequest} from "next/server";
import source from "@/data/source.json";
import {originAllowed,readConnection,safeMessage,trustLedgerRequest} from "@/lib/integration";
import {answer,rejection} from "@/lib/responses";
export const runtime="nodejs";
export const maxDuration=30;
export async function POST(request:NextRequest){
  if(!originAllowed(request))return rejection("Invalid request origin.",403);
  const session=await readConnection();
  if(!session)return rejection("Connect this sandbox to TrustLedger first.",401);
  const entries:{source_event_id:string;status:string;stored:boolean;case_reference:string|null}[]=[];
  for(const item of source.items){
    let result:{status:number;data:unknown};
    try{result=await trustLedgerRequest("/api/connectors/v1/observations",session.key,"POST",item);}
    catch{return answer({success:false,items:entries,error:"Delivery interrupted. You may retry: source event IDs are idempotent."},502);}
    if(result.status!==200 && result.status!==201){
      return answer({success:false,items:entries,error:safeMessage(result),http_status:result.status},502);
    }
    const ack=result.data as {source_event_id:string;status:string;observation_stored:boolean;case_reference:string|null};
    entries.push({source_event_id:ack.source_event_id,status:ack.status,stored:ack.observation_stored,case_reference:ack.case_reference});
  }
  return answer({success:true,items:entries,case_reference:entries.findLast(x=>x.case_reference)?.case_reference??null});
}
