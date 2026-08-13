import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "build/dbf-staging-pages");
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, "portal/management-app"), path.join(output, "management-app"), { recursive: true });
fs.cpSync(path.join(root, "portal/js"), path.join(output, "js"), { recursive: true });
fs.copyFileSync(path.join(root, "deploy/dbf-staging/firebase-config.js"), path.join(output, "js/firebase-config.js"));
fs.copyFileSync(path.join(root, "deploy/dbf-staging/runtime.js"), path.join(output, "dbf-staging-runtime.js"));
fs.copyFileSync(
  path.join(root, "deploy/dbf-cloud-run-staging-bff-candidate/canonical-navigation.js"),
  path.join(output, "dbf-staging-canonical-navigation.js")
);

const managementIndex = path.join(output, "management-app/index.html");
const html = fs.readFileSync(managementIndex, "utf8");
const marker = '<script type="module" src="./app-v2.js';
if (!html.includes(marker)) throw new Error("Management application entrypoint not found.");
fs.writeFileSync(managementIndex, html.replace(marker, '<script src="../dbf-staging-runtime.js"></script>\n  ' + marker), "utf8");
fs.writeFileSync(
  path.join(output, "index.html"),
  '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; base-uri \'none\'; form-action \'none\'"><title>DBF STAGING</title><script type="module" src="/dbf-staging-canonical-navigation.js"></script></head><body><p>DBF STAGINGを開いています。</p></body></html>',
  "utf8"
);

const builtConfig = fs.readFileSync(path.join(output, "js/firebase-config.js"), "utf8");
const forbiddenProjectRef = ["nkmxevmioczc", "mnldreyo"].join("");
if (!builtConfig.includes("zgkoofphhivesclehrom") || builtConfig.includes(`https://${forbiddenProjectRef}.supabase.co`)) {
  throw new Error("Staging build contains an invalid Supabase target.");
}
process.stdout.write(`${JSON.stringify({ output, environment: "staging", projectRef: "zgkoofphhivesclehrom", productionWrite: 0 })}\n`);
