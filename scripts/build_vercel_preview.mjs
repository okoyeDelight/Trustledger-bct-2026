/**
 * Vercel preview: publish ONLY the reviewed synthetic web runtime.
 *
 * The source repository includes private team discussions in Git history.
 * Neither repository docs nor that history belong in the public site output.
 * Intentionally avoid copying arbitrary directories or using the repository
 * root as a static output folder.
 */
import { mkdir, rm, copyFile, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";

const out = resolve("_site_vercel");
const sourceFiles = Object.freeze([
  "index.html",
  "styles.css",
  "service-worker.js",
  "src/app.js",
  "src/engine.js",
  "src/source_evidence.js",
  "src/custody_fixtures.js",
  "workspace/index.html",
  "workspace/workspace.css",
  "workspace/workspace.js",
]);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const relative of sourceFiles) {
  const src = resolve(relative);
  const dst = resolve(out, relative);
  if (!src.startsWith(process.cwd() + "/")) throw Error("Unexpected source path");
  await mkdir(dirname(dst), { recursive: true });
  await copyFile(src, dst);
}

// Confirm only expected files exist, not just that we happened to copy some.
async function walk(dir, relative = "") {
  const results = [];
  for (const name of await readdir(dir)) {
    const rel = join(relative, name);
    const full = join(dir, name);
    if ((await stat(full)).isDirectory()) results.push(...await walk(full, rel));
    else results.push(rel.replaceAll("\\", "/"));
  }
  return results.sort();
}
// Publish only the Clerk publishable key, which is public by design.
const rawKey = process.env.TRUSTLEDGER_CLERK_PUBLISHABLE_KEY || "";
if (rawKey && !/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(rawKey))
  throw Error("Invalid Clerk publishable key configuration (value not printed)");
await writeFile(join(out, "workspace/auth-config.js"),
  "window.TRUSTLEDGER_CLERK_PUBLISHABLE_KEY = " + JSON.stringify(rawKey) + ";\\n");
const expected = [...sourceFiles, "workspace/auth-config.js"].sort();
const actual = await walk(out);
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw Error("Unexpected public-site output. Expected " + expected + "; got " + actual);
}
const html = await readFile(join(out, "index.html"), "utf8");
const app = await readFile(join(out, "src/app.js"), "utf8");
if (!html.includes("SYNTHETIC DATA ONLY") ||
    !app.includes("buildHandoffPacket")) {
  throw Error("Site is missing synthetic data disclosure or current handoff feature");
}
for (const blocked of ["HANDOFF.md","CLAUDE.md","docs/","submission/","blood_system.sqlite",".git/"]) {
  if (actual.some(path => path.includes(blocked))) throw Error("Private file in public output");
}
console.log("Verified Vercel site output (synthetic-only): " + actual.join(", "));
