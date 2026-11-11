import { readConnection,trustLedgerRequest } from "@/lib/integration";
import {answer} from "@/lib/responses";
export const runtime="nodejs";
export async function GET(){
  const session=await readConnection();
  if(!session)return answer({connected:false});
  try{
    const result=await trustLedgerRequest("/api/connectors/v1/connection",session.key);
    return answer({connected:result.status===200,source_system:session.source_system,facility_code:session.facility_code,cursor:session.cursor??0});
  }catch{return answer({connected:false,error:"TrustLedger could not be reached."},503);}
}
