import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const here = resolve(import.meta.dirname);
const repository = resolve(here, "../..");
const output = join(here, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(join(output, "store-sales"), { recursive: true });
await cp(join(repository, "portal/store-sales"), join(output, "store-sales"), {
  recursive: true,
  filter: (source) => !new Set([
    "runtime-config.production.js", "staging-config.js", "staging-session-bootstrap.js",
    "staging.html", "staging-area-manager.html", "staging-sales-manager.html", "staging-store-manager.html"
  ]).has(source.split(/[\\/]/).pop())
});
await mkdir(join(output, "css"), { recursive: true });
await mkdir(join(output, "js"), { recursive: true });
await cp(join(repository, "portal/css/design-system.css"), join(output, "css/design-system.css"));
await cp(join(repository, "portal/js/nov-hub-session-candidate.js"), join(output, "js/nov-hub-session-candidate.js"));
await writeFile(join(output, "store-sales/runtime-config.js"), `globalThis.STORE_SALES_RUNTIME_CONFIG=Object.freeze({mode:"integration",featureFlag:"staging",preview:false,requireHubSession:true,integrationEndpoint:"https://zgkoofphhivesclehrom.supabase.co/functions/v1/nov-hub-api",contractVersion:"STORE_MONTHLY_ACTUAL_V1",timeoutMs:12000});\n`);
const forbidden = "nkmxevmioczcmnldreyo";
for (const file of ["store-sales/runtime-config.js"]) {
  if ((await readFile(join(output, file), "utf8")).includes(forbidden)) throw new Error("PRODUCTION_REF_IN_BROWSER_BUILD");
}
