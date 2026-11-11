import {NextRequest} from "next/server";
import {searchSourceRecords} from "@/lib/record-search";
import {answer,rejection} from "@/lib/responses";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
  const url=request.nextUrl;
  const dataset=url.searchParams.get("dataset")??"";
  const query=url.searchParams.get("q")??"";
  if(query.trim().length<2 || query.length>180)
    return rejection("Enter at least two characters of a source ID, facility, or name.",422);
  const limit=Math.min(20,Math.max(1,Number(url.searchParams.get("limit")??15)||15));
  try{
    const results=await searchSourceRecords(dataset,query,limit);
    const response=answer(results);
    response.headers.set("Cache-Control","no-store");
    return response;
  }catch(error){
    return rejection(error instanceof Error?error.message:"Source search unavailable.",503);
  }
}
