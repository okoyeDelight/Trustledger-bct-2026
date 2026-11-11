import { NextResponse } from "next/server";
export const noStore={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
export function answer(data:unknown,status=200){
  return NextResponse.json(data,{status,headers:noStore});
}
export function rejection(message:string,status:number){
  return answer({error:message},status);
}
