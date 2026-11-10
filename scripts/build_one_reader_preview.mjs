import { mkdir, rm, copyFile, readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
const out=resolve("_site_one_reader");
const allowed = Object.freeze([
  ["worker.html","index.html"],
  ["worker.css","worker.css"],
  ["src/worker-app.js","src/worker-app.js"],
  ["src/engine.js","src/engine.js"],
  ["src/source_evidence.js","src/source_evidence.js"],
  ["src/custody_fixtures.js","src/custody_fixtures.js"],
]);
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for (const [source,destination] of allowed) {
  const dest=resolve(out,destination);
  await mkdir(dirname(dest),{recursive:true});
  await copyFile(resolve(source),dest);
}
async function visit(folder,prefix=""){
  const paths=[];
  for(const child of await readdir(folder)){
    const rel=join(prefix,child),absolute=join(folder,child);
    if((await stat(absolute)).isDirectory()) paths.push(...await visit(absolute,rel));
    else paths.push(rel.replaceAll("\\","/"));
  }
  return paths.sort();
}
const actual=await visit(out),expected=allowed.map(x=>x[1]).sort();
if(JSON.stringify(actual)!==JSON.stringify(expected)) throw Error("Unexpected public files: "+actual.join(", "));
const html=await readFile(join(out,"index.html"),"utf8");
const app=await readFile(join(out,"src/worker-app.js"),"utf8");
if(!html.includes("SYNTHETIC DEMO")||!app.includes("clinical release")||!app.includes("issueGuard"))
  throw Error("Synthetic boundary or issue control missing");
console.log("Single-source website package verified: "+actual.join(", "));
