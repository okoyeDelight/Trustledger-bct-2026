import {readConnection,safeMessage,trustLedgerRequest} from "@/lib/integration";
import {answer,rejection} from "@/lib/responses";
export const runtime="nodejs";
export async function GET(){
  const c=await readConnection();
  if(!c)return rejection("Connect to TrustLedger first.",401);
  try{
    const upstream=await trustLedgerRequest("/api/connectors/v1/cases",c.key);
    if(upstream.status!==200)return rejection(safeMessage(upstream),upstream.status===401?401:502);
    return answer(upstream.data);
  }catch{return rejection("Could not retrieve case updates.",503);}
}
