import {NextRequest} from "next/server";
import {searchSourceRecords} from "@/lib/record-search";
import {answer,rejection} from "@/lib/responses";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
  const url=request.nextUrl;
  const dataset=url.searchParams.get("dataset")??"";
  const recordId=url.searchParams.get("record_id")??"";
  if(!recordId || recordId.length>180)return rejection("Invalid record ID.",422);
  try{
    const lookup=await searchSourceRecords(dataset,recordId,1,true);
    if(lookup.items.length===0)return rejection("Original source record not found.",404);
    const response=answer(lookup.items[0]);
    response.headers.set("Cache-Control","no-store");
    return response;
  }catch(error){
    return rejection(error instanceof Error?error.message:"Source lookup unavailable.",503);
  }
}
