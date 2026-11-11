import { NextRequest } from "next/server";
import source from "@/data/source.json";
import { originAllowed, saveConnection, safeMessage, trustLedgerRequest } from "@/lib/integration";
import { answer, rejection } from "@/lib/responses";

export const runtime="nodejs";
export async function POST(req:NextRequest){
  if(!originAllowed(req))return rejection("Invalid request origin.",403);
  let payload:unknown;
  try{payload=await req.json();}catch{return rejection("Enter a valid connector key.",400);}
  const raw=(payload as {api_key?:unknown})?.api_key;
  if(typeof raw!=="string" || raw.length<35 || raw.length>100 || !raw.startsWith("tlc_")){
    return rejection("Paste a TrustLedger connector key created by a Quality Supervisor.",400);
  }
  try {
    const remote=await trustLedgerRequest("/api/connectors/v1/connection",raw);
    if(remote.status!==200)return rejection(safeMessage(remote),remote.status===401?401:502);
    const remoteInfo=remote.data as {connected?:boolean;source_system?:string;facility_code?:string};
    if(remoteInfo.connected!==true)return rejection("That is not an external system API key.",403);
    if(remoteInfo.source_system!==source.source_system || remoteInfo.facility_code!==source.facility_id){
      return rejection("This sandbox needs source "+source.source_system+" and facility "+source.facility_id+". Please generate a connector key for those exact identifiers.",403);
    }
    await saveConnection({key:raw,source_system:remoteInfo.source_system,facility_code:remoteInfo.facility_code,saved_at:Date.now()});
    return answer({connected:true,source_system:remoteInfo.source_system,facility_code:remoteInfo.facility_code});
  } catch {
    return rejection("Unable to reach TrustLedger. Check that the API deployment is available.",503);
  }
}
