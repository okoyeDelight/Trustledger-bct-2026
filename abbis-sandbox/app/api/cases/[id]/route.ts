import {readConnection,safeMessage,trustLedgerRequest} from "@/lib/integration";
import {answer,rejection} from "@/lib/responses";
export const runtime="nodejs";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  const {id}=await context.params;
  if(!/^EXT-[0-9a-f-]{36}$/.test(id))return rejection("Invalid case reference.",400);
  const c=await readConnection();
  if(!c)return rejection("Connect to TrustLedger first.",401);
  try{
    const upstream=await trustLedgerRequest("/api/connectors/v1/cases/"+encodeURIComponent(id),c.key);
    if(upstream.status!==200)return rejection(safeMessage(upstream),upstream.status===404?404:upstream.status===401?401:502);
    return answer(upstream.data);
  }catch{return rejection("Could not retrieve case status.",503);}
}
