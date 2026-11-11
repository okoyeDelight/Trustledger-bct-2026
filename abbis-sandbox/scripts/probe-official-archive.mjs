import crypto from "node:crypto";

const id="1p4eX9t0y0W94EKIkzAshrA2Rb1y2gZZ7";
const urls=[
  "https://drive.usercontent.google.com/download?id="+id+"&export=download&confirm=t",
  "https://drive.google.com/uc?export=download&confirm=t&id="+id,
];
const expected="c6b3c0a461a86adac72424ab11e179d22449e268ac3253b69b68613ce1911732";
let verified=false;
for(const url of urls){
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
    const type=response.headers.get("content-type")??"unknown";
    const size=response.headers.get("content-length")??"unknown";
    console.log("official archive probe",response.status,type,size, response.url.slice(0,110));
    if(!response.ok)continue;
    const blob=Buffer.from(await response.arrayBuffer());
    const sha=crypto.createHash("sha256").update(blob).digest("hex");
    console.log("download byte length",blob.length,"ZIP magic",blob.subarray(0,4).toString("hex"),"SHA matches",sha===expected);
    if(blob.length===38875927&&sha===expected){verified=true;break;}
  }catch(e){console.log("probe exception",e instanceof Error?e.message:String(e));}
}
if(!verified)process.exitCode=1;
