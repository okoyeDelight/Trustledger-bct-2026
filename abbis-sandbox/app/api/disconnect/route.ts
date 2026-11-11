import {NextRequest} from "next/server";
import {clearConnection,originAllowed} from "@/lib/integration";
import {answer,rejection} from "@/lib/responses";
export const runtime="nodejs";
export async function POST(request:NextRequest){
  if(!originAllowed(request))return rejection("Invalid request origin.",403);
  await clearConnection();
  return answer({disconnected:true});
}
