import "server-only";
import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const COOKIE_NAME = "abbis_sandbox_connection";
export type Connection = { key: string; source_system: string; facility_code: string; saved_at: number };
export type PartnerStatus = { connected: boolean; source_system: string; facility_code: string; authenticated: boolean };

function keyBytes(): Buffer {
  const secret = process.env.SANDBOX_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Sandbox secure-session encryption is not configured.");
  return createHash("sha256").update(secret).digest();
}
function seal(connection: Connection): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(connection),"utf8"),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString("base64url");
}
function unseal(token: string): Connection | null {
  try {
    const bytes = Buffer.from(token,"base64url");
    if (bytes.length < 30) return null;
    const dec = createDecipheriv("aes-256-gcm",keyBytes(),bytes.subarray(0,12));
    dec.setAuthTag(bytes.subarray(12,28));
    const data = Buffer.concat([dec.update(bytes.subarray(28)),dec.final()]).toString("utf8");
    const obj:unknown=JSON.parse(data);
    if (!obj || typeof obj !== "object") return null;
    const c = obj as Connection;
    if (!c.key?.startsWith("tlc_") || !c.source_system || !c.facility_code || !Number.isFinite(c.saved_at)) return null;
    if (Date.now()-c.saved_at>24*60*60*1000) return null;
    return c;
  } catch { return null; }
}
export async function readConnection(): Promise<Connection | null> {
  const jar=await cookies();
  const stored=jar.get(COOKIE_NAME)?.value;
  return stored?unseal(stored):null;
}
export async function saveConnection(c:Connection):Promise<void> {
  const jar=await cookies();
  jar.set(COOKIE_NAME,seal(c),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:86400});
}
export async function clearConnection():Promise<void>{
  (await cookies()).delete(COOKIE_NAME);
}
function apiOrigin():string {
  const raw=process.env.TRUSTLEDGER_API_URL;
  if(!raw)throw new Error("TrustLedger API URL is not configured.");
  const u=new URL(raw);
  if(u.protocol!=="https:" || u.username || u.password || u.search || u.hash)
    throw new Error("TrustLedger API must use a clean HTTPS URL.");
  return u.origin;
}
export function remoteOrigin():string{return apiOrigin();}
export async function trustLedgerRequest(path:string, key:string, method:"GET"|"POST"="GET", body?:unknown):Promise<{status:number;data:unknown}> {
  if(!path.startsWith("/api/") || path.startsWith("//"))throw new Error("Invalid integration endpoint.");
  const h:Record<string,string>={"X-TrustLedger-Connector-Key":key,"Accept":"application/json"};
  if(body!==undefined)h["Content-Type"]="application/json";
  // Optional deployment-protection bypass belongs ONLY in server-to-server requests.
  const bypass=process.env.TRUSTLEDGER_PREVIEW_BYPASS_SECRET;
  if(bypass)h["x-vercel-protection-bypass"]=bypass;
  const response=await fetch(apiOrigin()+path,{
    method,headers:h,body:body===undefined?undefined:JSON.stringify(body),
    cache:"no-store",signal:AbortSignal.timeout(10000),redirect:"manual",
  });
  let data:unknown;
  const contentType=response.headers.get("content-type")||"";
  if(contentType.includes("application/json"))data=await response.json();
  else data={detail:response.status>=300&&response.status<400?"Target requires deployment authorization.":"The remote API did not return JSON."};
  return {status:response.status,data};
}
export function originAllowed(request:Request):boolean {
  const origin=request.headers.get("origin");
  if(!origin)return false;
  try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}
export function safeMessage(result:{status:number;data:unknown}):string {
  const d=result.data as {detail?:unknown};
  if(typeof d?.detail==="string")return d.detail.slice(0,240);
  return "TrustLedger rejected the request (HTTP "+result.status+").";
}
