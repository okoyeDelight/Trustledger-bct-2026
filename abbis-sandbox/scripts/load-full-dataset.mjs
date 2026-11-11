import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {inflateRawSync} from "node:zlib";

/**
 * The official organizer ZIP is NOT checked into Git. This loader verifies the
 * full archive and all eleven CSVs against a pinned manifest, then places
 * exact original bytes in the ABBIS server's non-public data/raw directory.
 *
 * The dataset is synthetic, but this demo is NOT a live medical system.
 */
function sha256(bytes){
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function extractZipEntries(archive){
  const files=new Map();
  let offset=0;
  while(offset+30<=archive.length && archive.readUInt32LE(offset)===0x04034b50){
    const flags=archive.readUInt16LE(offset+6);
    const method=archive.readUInt16LE(offset+8);
    const compressedSize=archive.readUInt32LE(offset+18);
    const uncompressedSize=archive.readUInt32LE(offset+22);
    const filenameSize=archive.readUInt16LE(offset+26);
    const extraSize=archive.readUInt16LE(offset+28);
    if(flags & 0x0008)throw Error("Unsupported ZIP data descriptor; refusing ambiguous source archive");
    const filename=archive.subarray(offset+30,offset+30+filenameSize).toString("utf8");
    const start=offset+30+filenameSize+extraSize;
    const end=start+compressedSize;
    if(end>archive.length)throw Error("Incomplete organizer ZIP entry: "+filename);
    if(filename.includes("/") || filename.includes("\\") || filename===".." || filename.startsWith(".")){
      // Ignore ancillary directory files, but never write arbitrary paths.
      offset=end;
      continue;
    }
    const compressed=archive.subarray(start,end);
    const uncompressed=method===0 ? compressed : method===8 ? inflateRawSync(compressed) : null;
    if(!uncompressed || uncompressed.length!==uncompressedSize)
      throw Error("Unsupported or invalid ZIP compression for "+filename);
    if(files.has(filename))throw Error("Duplicate filename inside organizer ZIP: "+filename);
    files.set(filename,uncompressed);
    offset=end;
  }
  return files;
}

export async function loadFullOfficialDataset(root){
  const manifest=JSON.parse(await fs.readFile(
    path.join(root,"data/organizer-archive-manifest.json"),"utf8"
  ));
  if(manifest.csv.length!==11)throw Error("Eleven original organizer CSV files required.");
  const folder=path.join(root,"data/raw");
  await fs.mkdir(folder,{recursive:true});
  let allLocal=true;
  for(const file of manifest.csv){
    try{
      const data=await fs.readFile(path.join(folder,file.file));
      if(data.length!==file.bytes||sha256(data)!==file.sha256){allLocal=false;break;}
    }catch{allLocal=false;break;}
  }
  if(allLocal){
    console.log("ALL_11_OFFICIAL_SOURCE_FILES_VERIFIED (cached local files)");
    return manifest.csv;
  }

  const response=await fetch(manifest.download_url,{
    signal:AbortSignal.timeout(120000),
    headers:{"User-Agent":"ABBIS-sandbox-organizer-pinned-source"}
  });
  if(!response.ok)throw Error("Cannot retrieve complete organizer archive (HTTP "+response.status+").");
  const archive=Buffer.from(await response.arrayBuffer());
  if(archive.length!==manifest.archive_bytes||sha256(archive)!==manifest.archive_sha256)
    throw Error("Official competition dataset archive SHA256/length verification failed.");
  const files=extractZipEntries(archive);
  for(const file of manifest.csv){
    const bytes=files.get(file.file);
    if(!bytes||bytes.length!==file.bytes||sha256(bytes)!==file.sha256)
      throw Error("Original organizer data mismatch: "+file.file);
    const rows=bytes.reduce((count,c)=>count+(c===10?1:0),0)-1;
    if(rows!==file.rows)throw Error("Unexpected organizer row count for "+file.file);
    await fs.writeFile(path.join(folder,file.file),bytes);
    console.log("Verified original organizer data:",file.file,rows+" rows");
  }
  console.log("ALL_11_OFFICIAL_SOURCE_FILES_VERIFIED");
  return manifest.csv;
}
